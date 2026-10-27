import { Db } from "mongodb";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import * as CryptoJS from "crypto-js";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";
import MfaDao, { UserMfa } from "../dao/mfaDao";
import UsersDao from "../dao/usersDao";
import MailSenderServices from "./mailSender";
import ErrorModel from "../../model/errorModel";
import { logger } from "../../index";

export type MfaMethod = "totp" | "email";
/** Al login si accetta anche un codice di recupero al posto del secondo fattore. */
export type MfaLoginMethod = MfaMethod | "recovery";

/** Validita' del codice inviato via email. */
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
/** Intervallo minimo tra due invii di codice email allo stesso utente. */
const EMAIL_CODE_RESEND_MS = 60 * 1000;
/** Tentativi errati ammessi sullo stesso codice email prima di invalidarlo. */
const EMAIL_CODE_MAX_ATTEMPTS = 5;
/** Numero di codici di recupero generati per volta. */
const RECOVERY_CODE_COUNT = 10;
/** Alfabeto senza caratteri ambigui (0/O, 1/I/L) per codici da trascrivere a mano. */
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Durata del ticket che collega password/OAuth alla verifica del secondo fattore. */
const MFA_TICKET_TTL = "5m";

/** Time step del codice TOTP valido (anti-replay), null se il codice non e' valido. */
function totpTimeStep(result: { valid: boolean }): number | null {
  return result.valid && "timeStep" in result && typeof result.timeStep === "number" ? result.timeStep : null;
}

export interface MfaTicket {
  purpose: "mfa";
  userId: string;
  email: string;
  rememberMe: boolean;
  oauth: boolean;
}

export default class MfaServices {
  private mfaDao: MfaDao;
  private usersDao: UsersDao;
  private mailSenderServices: MailSenderServices;
  constructor(db: Db) {
    this.mfaDao = new MfaDao(db);
    this.usersDao = new UsersDao(db);
    this.mailSenderServices = new MailSenderServices(db);
  }

  // ---------------------------------------------------------------- config

  private secretKey(): string {
    return process.env.SECRET_KEY || "";
  }

  /**
   * Chiave dedicata al ticket MFA: derivata ma DIVERSA da quella del JWT di
   * sessione, cosi' un ticket messo nel cookie "jwt" non supera authMiddleware.
   */
  private ticketKey(): string {
    return `${this.secretKey()}:mfa-ticket`;
  }

  private appName(): string {
    return process.env.APP_NAME || "Pintour";
  }

  /** Origini ammesse per WebAuthn: WEBAUTHN_ORIGIN (lista) oppure CLIENT_URL. */
  private webauthnOrigins(): string[] {
    const raw = process.env.WEBAUTHN_ORIGIN || process.env.CLIENT_URL || "";
    return raw
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean);
  }

  /** RP ID = dominio del sito (senza porta), override con WEBAUTHN_RP_ID. */
  private rpID(): string {
    if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID;
    const origin = this.webauthnOrigins()[0];
    if (!origin) throw new ErrorModel(500, "Passkey non configurate (CLIENT_URL/WEBAUTHN_ORIGIN mancanti)");
    return new URL(origin).hostname;
  }

  private encrypt(value: string): string {
    return CryptoJS.AES.encrypt(value, this.secretKey()).toString();
  }

  private decrypt(value: string): string {
    return CryptoJS.AES.decrypt(value, this.secretKey()).toString(CryptoJS.enc.Utf8);
  }

  private hashCode(code: string): string {
    return crypto.createHash("sha256").update(`${this.secretKey()}:${code}`).digest("hex");
  }

  private sameHash(a: string, b: string): boolean {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
  }

  // ---------------------------------------------------------------- stato

  async getMfa(userId: string): Promise<UserMfa | null> {
    return this.mfaDao.getByUserId(userId);
  }

  /** Metodi di secondo fattore attivi (in ordine di preferenza). */
  async getLoginMethods(userId: string): Promise<MfaMethod[]> {
    const mfa = await this.mfaDao.getByUserId(userId);
    const methods: MfaMethod[] = [];
    if (mfa?.totp?.enabled) methods.push("totp");
    if (mfa?.email?.enabled) methods.push("email");
    return methods;
  }

  /** Stato per la pagina account: MAI segreti o chiavi pubbliche. */
  async getStatus(userId: string) {
    const mfa = await this.mfaDao.getByUserId(userId);
    return {
      totp: !!mfa?.totp?.enabled,
      email: !!mfa?.email?.enabled,
      recoveryCodes: mfa?.recoveryCodes?.length || 0,
      passkeys: (mfa?.passkeys || []).map((p) => ({
        id: p.id,
        name: p.name,
        createdAt: p.createdAt,
        lastUsedAt: p.lastUsedAt,
      })),
    };
  }

  // ---------------------------------------------------------------- ticket di login

  /**
   * Dopo password/OAuth corretti: se l'utente ha un secondo fattore attivo
   * restituisce la risposta "mfaRequired" (con ticket firmato a breve scadenza),
   * altrimenti null e il chiamante crea subito la sessione.
   */
  async startLoginChallenge(email: string, rememberMe: boolean, oauth: boolean) {
    const user = await this.usersDao.getUserByEmailAll(email);
    if (!user) return null;
    const userId = String(user._id);
    const methods = await this.getLoginMethods(userId);
    if (methods.length === 0) return null;

    const ticket: MfaTicket = { purpose: "mfa", userId, email: user.email, rememberMe: !!rememberMe, oauth };
    const mfaToken = jwt.sign(ticket, this.ticketKey(), { expiresIn: MFA_TICKET_TTL });

    // Unico metodo = email: il codice parte subito, senza un click in piu'.
    if (methods.length === 1 && methods[0] === "email") {
      try {
        await this.sendEmailCode(userId, user.email, user.options?.lng);
      } catch (error) {
        // il ticket resta valido: dalla schermata del codice si puo' richiedere un nuovo invio
      }
    }
    return { mfaRequired: true, methods, mfaToken };
  }

  readTicket(mfaToken: string): MfaTicket {
    try {
      const decoded: any = jwt.verify(String(mfaToken || ""), this.ticketKey());
      if (decoded?.purpose !== "mfa" || !decoded.userId || !decoded.email) throw new Error("ticket non valido");
      return decoded as MfaTicket;
    } catch (error) {
      throw new ErrorModel(401, "Sessione di verifica scaduta. Effettua di nuovo l'accesso.");
    }
  }

  /** Verifica il codice del metodo scelto; true se valido. */
  async verifySecondFactor(userId: string, method: MfaLoginMethod, code: string): Promise<boolean> {
    const methods = await this.getLoginMethods(userId);
    if (method === "recovery") return methods.length > 0 && this.consumeRecoveryCode(userId, code);
    if (!methods.includes(method)) return false;
    if (method === "totp") return this.verifyTotpCode(userId, code);
    return this.verifyEmailCode(userId, code);
  }

  // ---------------------------------------------------------------- TOTP (app)

  async setupTotp(userId: string, email: string) {
    const secret = generateSecret();
    await this.mfaDao.set(userId, { "totp.pendingSecret": this.encrypt(secret) });
    const uri = generateURI({ issuer: this.appName(), label: email, secret });
    return { secret, uri };
  }

  async enableTotp(userId: string, code: string): Promise<string[] | null> {
    const mfa = await this.mfaDao.getByUserId(userId);
    if (!mfa?.totp?.pendingSecret) throw new ErrorModel(400, "Nessuna configurazione in corso. Riprova.");
    const token = String(code || "").trim();
    if (!/^\d{6}$/.test(token)) throw new ErrorModel(400, "Codice non valido");
    const secret = this.decrypt(mfa.totp.pendingSecret);
    const timeStep = totpTimeStep(await verifyTotp({ secret, token, epochTolerance: 30 }));
    if (timeStep === null) throw new ErrorModel(400, "Codice non valido");
    await this.mfaDao.set(userId, {
      totp: { enabled: true, secret: mfa.totp.pendingSecret, lastTimeStep: timeStep },
    });
    logger.info(`2FA app attivata per utente ${userId}`);
    return this.ensureRecoveryCodes(userId);
  }

  async disableTotp(userId: string, code: string): Promise<void> {
    if (!(await this.verifyTotpCode(userId, code))) throw new ErrorModel(400, "Codice non valido");
    await this.mfaDao.unset(userId, ["totp"]);
    await this.dropRecoveryCodesIfUnused(userId);
    logger.info(`2FA app disattivata per utente ${userId}`);
  }

  private async verifyTotpCode(userId: string, code: string): Promise<boolean> {
    const mfa = await this.mfaDao.getByUserId(userId);
    if (!mfa?.totp?.enabled || !mfa.totp.secret) return false;
    const token = String(code || "").trim();
    if (!/^\d{6}$/.test(token)) return false;
    const timeStep = totpTimeStep(
      await verifyTotp({
        secret: this.decrypt(mfa.totp.secret),
        token,
        epochTolerance: 30,
        afterTimeStep: mfa.totp.lastTimeStep,
      }),
    );
    if (timeStep === null) return false;
    return this.mfaDao.consumeTotpTimeStep(userId, timeStep);
  }

  // ---------------------------------------------------------------- codice via email

  async sendEmailCode(userId: string, email: string, lng: string = "it"): Promise<void> {
    const mfa = await this.mfaDao.getByUserId(userId);
    if (mfa?.emailCode?.sentAt && Date.now() - mfa.emailCode.sentAt < EMAIL_CODE_RESEND_MS) {
      // codice appena inviato: non se ne genera un altro (anti-spam della casella)
      return;
    }
    const code = crypto.randomInt(0, 1000000).toString().padStart(6, "0");
    await this.mfaDao.set(userId, {
      emailCode: { hash: this.hashCode(code), expiresAt: Date.now() + EMAIL_CODE_TTL_MS, attempts: 0, sentAt: Date.now() },
    });
    const it = lng !== "en";
    let sent = false;
    try {
      sent = await this.mailSenderServices.sendMfaCode(
        email,
        it ? "Codice di verifica" : "Verification code",
        it
          ? `Il tuo codice di verifica è <b>${code}</b>.<br>Scade tra 10 minuti. Se non hai richiesto tu l'accesso, cambia la password.`
          : `Your verification code is <b>${code}</b>.<br>It expires in 10 minutes. If you did not request it, change your password.`,
      );
    } catch (error: any) {
      logger.error(`Invio codice 2FA a ${email} fallito: ${error?.message || error}`);
    }
    if (!sent) {
      // codice mai arrivato: niente blocco anti-spam sul prossimo tentativo
      await this.mfaDao.unset(userId, ["emailCode"]);
      throw new ErrorModel(503, "Invio email non disponibile. Riprova più tardi.");
    }
  }

  private async verifyEmailCode(userId: string, code: string): Promise<boolean> {
    const mfa = await this.mfaDao.getByUserId(userId);
    const stored = mfa?.emailCode;
    if (!stored || stored.expiresAt < Date.now() || stored.attempts >= EMAIL_CODE_MAX_ATTEMPTS) return false;
    const token = String(code || "").trim();
    if (!/^\d{6}$/.test(token) || !this.sameHash(stored.hash, this.hashCode(token))) {
      await this.mfaDao.incrementEmailCodeAttempts(userId);
      return false;
    }
    // monouso
    await this.mfaDao.unset(userId, ["emailCode"]);
    return true;
  }

  async enableEmail(userId: string, code: string): Promise<string[] | null> {
    // In attivazione il metodo non e' ancora "attivo": si verifica direttamente il codice.
    if (!(await this.verifyEmailCode(userId, code))) throw new ErrorModel(400, "Codice non valido");
    await this.mfaDao.set(userId, { email: { enabled: true } });
    logger.info(`2FA email attivata per utente ${userId}`);
    return this.ensureRecoveryCodes(userId);
  }

  async disableEmail(userId: string, code: string): Promise<void> {
    if (!(await this.verifyEmailCode(userId, code))) throw new ErrorModel(400, "Codice non valido");
    await this.mfaDao.unset(userId, ["email"]);
    await this.dropRecoveryCodesIfUnused(userId);
    logger.info(`2FA email disattivata per utente ${userId}`);
  }

  // ---------------------------------------------------------------- codici di recupero

  /**
   * Nuovo set di codici (i precedenti smettono di valere). Restituisce i codici
   * in chiaro UNA sola volta: a DB resta solo l'hash.
   */
  private async generateRecoveryCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const chars = Array.from({ length: 8 }, () => RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)]).join("");
      return `${chars.slice(0, 4)}-${chars.slice(4)}`;
    });
    await this.mfaDao.set(userId, { recoveryCodes: codes.map((c) => this.hashCode(this.normalizeRecoveryCode(c))) });
    return codes;
  }

  /** Alla prima attivazione di un fattore genera i codici; se esistono gia' non li tocca. */
  private async ensureRecoveryCodes(userId: string): Promise<string[] | null> {
    const mfa = await this.mfaDao.getByUserId(userId);
    if (mfa?.recoveryCodes?.length) return null;
    return this.generateRecoveryCodes(userId);
  }

  /** Senza piu' fattori attivi i codici di recupero non hanno senso. */
  private async dropRecoveryCodesIfUnused(userId: string): Promise<void> {
    if ((await this.getLoginMethods(userId)).length === 0) {
      await this.mfaDao.unset(userId, ["recoveryCodes"]);
    }
  }

  /** Rigenerazione dall'account: richiede un codice valido di un fattore attivo. */
  async regenerateRecoveryCodes(userId: string, method: MfaMethod, code: string): Promise<string[]> {
    if (!(await this.verifySecondFactor(userId, method, code))) throw new ErrorModel(400, "Codice non valido");
    logger.info(`Codici di recupero rigenerati per utente ${userId}`);
    return this.generateRecoveryCodes(userId);
  }

  private normalizeRecoveryCode(code: string): string {
    return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  private async consumeRecoveryCode(userId: string, code: string): Promise<boolean> {
    const normalized = this.normalizeRecoveryCode(code);
    if (normalized.length !== 8) return false;
    const used = await this.mfaDao.consumeRecoveryCode(userId, this.hashCode(normalized));
    if (used) logger.warn(`Codice di recupero usato per utente ${userId}`);
    return used;
  }

  // ---------------------------------------------------------------- passkey

  async passkeyRegistrationOptions(userId: string, email: string, displayName: string) {
    const mfa = await this.mfaDao.getByUserId(userId);
    const options = await generateRegistrationOptions({
      rpName: this.appName(),
      rpID: this.rpID(),
      userName: email,
      userDisplayName: displayName || email,
      userID: new TextEncoder().encode(String(userId)),
      attestationType: "none",
      excludeCredentials: (mfa?.passkeys || []).map((p) => ({ id: p.id, transports: p.transports })),
      // credenziale individuabile: permette il login senza digitare l'email
      authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
    });
    const challengeId = await this.mfaDao.createChallenge(options.challenge, "passkey-register", userId);
    return { challengeId, options };
  }

  async passkeyRegistrationVerify(userId: string, challengeId: string, response: RegistrationResponseJSON, name: string) {
    const challenge = await this.mfaDao.consumeChallenge(challengeId, "passkey-register");
    if (!challenge || challenge.userId !== String(userId)) throw new ErrorModel(400, "Registrazione scaduta. Riprova.");

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.webauthnOrigins(),
        expectedRPID: this.rpID(),
        requireUserVerification: false,
      });
    } catch (error: any) {
      logger.warn(`Registrazione passkey fallita per ${userId}: ${error?.message}`);
      throw new ErrorModel(400, "Passkey non valida");
    }
    if (!verification.verified) throw new ErrorModel(400, "Passkey non valida");

    const { credential } = verification.registrationInfo;
    if (await this.mfaDao.getByPasskeyId(credential.id)) throw new ErrorModel(409, "Passkey gia' registrata");
    await this.mfaDao.addPasskey(userId, {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports,
      name: String(name || "Passkey").slice(0, 60),
      createdAt: Date.now(),
    });
    logger.info(`Passkey registrata per utente ${userId}`);
  }

  async removePasskey(userId: string, credentialId: string): Promise<void> {
    if (!(await this.mfaDao.removePasskey(userId, credentialId))) throw new ErrorModel(404, "Passkey non trovata");
  }

  async passkeyLoginOptions() {
    // nessuna allowCredentials: il browser propone le passkey salvate per il sito
    const options = await generateAuthenticationOptions({ rpID: this.rpID(), userVerification: "preferred" });
    const challengeId = await this.mfaDao.createChallenge(options.challenge, "passkey-login");
    return { challengeId, options };
  }

  /** Verifica l'asserzione WebAuthn e restituisce l'email dell'utente autenticato. */
  async passkeyLoginVerify(challengeId: string, response: AuthenticationResponseJSON): Promise<string> {
    const invalid = new ErrorModel(400, "Accesso con passkey non riuscito");
    const challenge = await this.mfaDao.consumeChallenge(challengeId, "passkey-login");
    if (!challenge || !response?.id) throw invalid;

    const mfa = await this.mfaDao.getByPasskeyId(response.id);
    const passkey = mfa?.passkeys?.find((p) => p.id === response.id);
    if (!mfa || !passkey) throw invalid;

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge.challenge,
        expectedOrigin: this.webauthnOrigins(),
        expectedRPID: this.rpID(),
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(Buffer.from(passkey.publicKey, "base64url")),
          counter: passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: false,
      });
    } catch (error: any) {
      logger.warn(`Login passkey fallito: ${error?.message}`);
      throw invalid;
    }
    if (!verification.verified) throw invalid;

    await this.mfaDao.updatePasskeyCounter(mfa.userId, passkey.id, verification.authenticationInfo.newCounter);
    const user = await this.usersDao.getUserById(mfa.userId);
    if (!user?.email) throw invalid;
    return user.email;
  }
}
