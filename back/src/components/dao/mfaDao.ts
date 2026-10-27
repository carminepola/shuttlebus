import { Db } from "mongodb";
import crypto from "crypto";

/**
 * Dati di autenticazione a piu' fattori di un utente.
 *
 * Collection SEPARATA da "users": il documento utente viene copiato nel JWT di
 * sessione (sessionServices.login), qui ci sono invece segreti TOTP e chiavi
 * pubbliche delle passkey che non devono mai finire in un token o in un output.
 * Chiave = _id dell'utente (non l'email): un account ricreato con la stessa
 * email non eredita i fattori del precedente.
 */
export interface PasskeyRecord {
  id: string; // credential ID base64url
  publicKey: string; // chiave pubblica COSE base64url
  counter: number;
  transports?: string[];
  name: string;
  createdAt: number;
  lastUsedAt?: number;
}

export interface UserMfa {
  userId: string;
  totp?: {
    enabled: boolean;
    secret?: string; // cifrato AES con SECRET_KEY
    pendingSecret?: string; // cifrato, in attesa di conferma con un primo codice
    lastTimeStep?: number; // anti-replay: un codice TOTP vale una sola volta
  };
  email?: {
    enabled: boolean;
  };
  emailCode?: {
    hash: string; // sha256 del codice, mai in chiaro
    expiresAt: number;
    attempts: number;
    sentAt: number;
  };
  passkeys?: PasskeyRecord[];
  recoveryCodes?: string[]; // sha256 dei codici di recupero, monouso
  updatedAt: number;
}

export interface AuthChallenge {
  _id: string;
  challenge: string;
  type: "passkey-register" | "passkey-login";
  userId?: string;
  expiresAt: Date;
}

export default class MfaDao {
  db: Db;
  schema: string = "user_mfa";
  challengeSchema: string = "auth_challenges";
  constructor(db: Db) {
    this.db = db;
  }

  async getByUserId(userId: string): Promise<UserMfa | null> {
    return this.db.collection<UserMfa>(this.schema).findOne({ userId: String(userId) }, { projection: { _id: 0 } });
  }

  async getByPasskeyId(credentialId: string): Promise<UserMfa | null> {
    return this.db.collection<UserMfa>(this.schema).findOne({ "passkeys.id": String(credentialId) }, { projection: { _id: 0 } });
  }

  async set(userId: string, fields: Record<string, any>): Promise<void> {
    await this.db
      .collection<UserMfa>(this.schema)
      .updateOne({ userId: String(userId) }, { $set: { ...fields, updatedAt: Date.now() } }, { upsert: true });
  }

  async unset(userId: string, fields: string[]): Promise<void> {
    const unset: Record<string, ""> = {};
    fields.forEach((f) => (unset[f] = ""));
    await this.db.collection<UserMfa>(this.schema).updateOne({ userId: String(userId) }, { $unset: unset, $set: { updatedAt: Date.now() } });
  }

  /**
   * Anti-replay TOTP atomico: aggiorna lastTimeStep SOLO se il nuovo e' maggiore,
   * cosi' due richieste concorrenti con lo stesso codice non passano entrambe.
   */
  async consumeTotpTimeStep(userId: string, timeStep: number): Promise<boolean> {
    const result = await this.db.collection<UserMfa>(this.schema).updateOne(
      {
        userId: String(userId),
        $or: [{ "totp.lastTimeStep": { $exists: false } }, { "totp.lastTimeStep": { $lt: timeStep } }],
      },
      { $set: { "totp.lastTimeStep": timeStep, updatedAt: Date.now() } },
    );
    return result.modifiedCount > 0;
  }

  async incrementEmailCodeAttempts(userId: string): Promise<void> {
    await this.db.collection<UserMfa>(this.schema).updateOne({ userId: String(userId) }, { $inc: { "emailCode.attempts": 1 } });
  }

  /** Consuma un codice di recupero in modo atomico: lo stesso codice non vale due volte. */
  async consumeRecoveryCode(userId: string, hash: string): Promise<boolean> {
    const result = await this.db
      .collection<UserMfa>(this.schema)
      .updateOne({ userId: String(userId), recoveryCodes: hash }, { $pull: { recoveryCodes: hash }, $set: { updatedAt: Date.now() } });
    return result.modifiedCount > 0;
  }

  async addPasskey(userId: string, passkey: PasskeyRecord): Promise<void> {
    await this.db
      .collection<UserMfa>(this.schema)
      .updateOne({ userId: String(userId) }, { $push: { passkeys: passkey }, $set: { updatedAt: Date.now() } }, { upsert: true });
  }

  async updatePasskeyCounter(userId: string, credentialId: string, counter: number): Promise<void> {
    await this.db
      .collection<UserMfa>(this.schema)
      .updateOne(
        { userId: String(userId), "passkeys.id": credentialId },
        { $set: { "passkeys.$.counter": counter, "passkeys.$.lastUsedAt": Date.now(), updatedAt: Date.now() } },
      );
  }

  async removePasskey(userId: string, credentialId: string): Promise<boolean> {
    const result = await this.db
      .collection<UserMfa>(this.schema)
      .updateOne({ userId: String(userId) }, { $pull: { passkeys: { id: String(credentialId) } }, $set: { updatedAt: Date.now() } });
    return result.modifiedCount > 0;
  }

  /** Challenge WebAuthn monouso a scadenza (TTL index su expiresAt). */
  async createChallenge(challenge: string, type: AuthChallenge["type"], userId?: string, ttlMs: number = 5 * 60 * 1000): Promise<string> {
    const id = crypto.randomBytes(24).toString("hex");
    const collection = this.db.collection<AuthChallenge>(this.challengeSchema);
    await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await collection.insertOne({ _id: id, challenge, type, userId, expiresAt: new Date(Date.now() + ttlMs) });
    return id;
  }

  /** Legge e CANCELLA la challenge: un secondo tentativo con lo stesso id fallisce. */
  async consumeChallenge(id: string, type: AuthChallenge["type"]): Promise<AuthChallenge | null> {
    const result = await this.db
      .collection<AuthChallenge>(this.challengeSchema)
      .findOneAndDelete({ _id: String(id), type, expiresAt: { $gt: new Date() } });
    return result || null;
  }
}
