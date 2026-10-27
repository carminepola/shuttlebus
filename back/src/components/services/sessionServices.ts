import UserServices from "./userServices";
import FailToBanServices from "./failToBanServices";
import { Db } from "mongodb";
import ErrorModel from "../../model/errorModel";
import { role } from "../../enum/role";
import { logger } from "../../index";

export default class SessionServices {
  private userServices: UserServices;
  private failToBan: FailToBanServices;
  constructor(db: Db) {
    this.userServices = new UserServices(db);
    this.failToBan = new FailToBanServices(db);
  }

  public async login(
    email: string,
    password: string,
    rememberMe: boolean,
  ): Promise<{
    userSession: any;
    sessionToken: {
      newSession: String;
      refreshToken: String;
    };
  }> {
    await this.verifyCredentials(email, password);
    return this.createUserSession(email, rememberMe);
  }

  /**
   * Solo verifica password + stato account (nessuna sessione creata): usata dal
   * login a due fattori, dove la sessione nasce dopo il secondo fattore.
   */
  public async verifyCredentials(email: string, password: string): Promise<void> {
    if (await this.userServices.checkPassword(email, password)) {
      this.failToBan.deleteIp(email);
      let userFind = await this.userServices.getUserByEmail(email);

      if (!userFind || userFind?.role == role.NO_PERMISSION) {
        throw new ErrorModel(400, "Credenziali non valide. Riprova.");
      }

      if (userFind?.disabled) {
        this.userServices.deleteOldSessions(email);
        throw new ErrorModel(400, "Account disattivato. Contatta l'amministratore.");
      }
    } else {
      this.failToBan.insertIp(email);
      const state = await this.failToBan.getFailState(email);
      // Log server-side del contatore tentativi falliti, senza dettagli al client
      logger.warn(`Tentativo di login fallito: email=${email} tentativi_falliti_account=${state.count}`);
      //new Error().stack
      throw new ErrorModel(400, "Credenziali non valide. Riprova.");
    }
  }

  /** Crea la sessione per un utente gia' autenticato (password + 2FA, passkey). */
  public async createUserSession(
    email: string,
    rememberMe: boolean,
  ): Promise<{
    userSession: any;
    sessionToken: {
      newSession: String;
      refreshToken: String;
    };
  }> {
    let userFind = await this.userServices.getUserByEmail(email);

    if (!userFind || userFind?.role == role.NO_PERMISSION) {
      throw new ErrorModel(400, "Credenziali non valide. Riprova.");
    }

    if (userFind?.disabled) {
      this.userServices.deleteOldSessions(email);
      throw new ErrorModel(400, "Account disattivato. Contatta l'amministratore.");
    }

    let sessionToken = await this.userServices.createSession(email);

    if (userFind?.sessions) {
      //va oltre le possibilità del cookie
      delete userFind.sessions;
    }

    let userSession: any = {
      ...userFind,
      rememberMe: rememberMe,
      session: sessionToken.newSession,
      email: email,
      _id: userFind?._id,
      role: userFind?.role >= 0 && userFind?.role != undefined && userFind?.role != null ? userFind.role : 9999,
      permissions: userFind?.permissions ? userFind.permissions : [],
    };

    delete userSession.options?.pin;

    this.userServices.deleteOldSessions(email);

    return { userSession, sessionToken };
  }
  public async loginGoogle(email: string): Promise<{
    userSession: any;
    sessionToken: {
      newSession: String;
      refreshToken: String;
    };
  }> {
    this.failToBan.deleteIp(email);
    let userFind = await this.userServices.getUserByEmailAll(email);

    if (!userFind) {
      throw new ErrorModel(400, "Account non trovato.");
    }

    if (userFind?.disabled) {
      this.userServices.deleteOldSessions(email);
      throw new ErrorModel(400, "Account disattivato. Contatta l'amministratore.");
    }

    if (userFind?.sessions) {
      //va oltre le possibilità del cookie
      delete userFind.sessions;
    }
    let sessionToken = await this.userServices.createSession(email);
    let userSession: any = {
      ...userFind,
      rememberMe: true,
      session: sessionToken.newSession,
      email: email,
      _id: userFind?._id,
      role: userFind?.role >= 0 && userFind?.role != undefined && userFind?.role != null ? userFind.role : 100,
      permissions: userFind?.permissions ? userFind.permissions : [],
    };

    delete userSession.options?.pin;

    this.userServices.deleteOldSessions(email);

    return { userSession, sessionToken };
  }
  public async logout(email: string, session: string): Promise<void> {
    let ris = await this.userServices.deleteSession(email, session);
    if (!ris) {
      throw new ErrorModel(404, "Nessuna sessione trovata");
    }
  }

  public async recoverPassword(email: string, lng: string): Promise<boolean> {
    // Flusso a token: la mail contiene solo un link /reset-password con token opaco
    // a scadenza. Nessuna password in chiaro via mail.
    let user = await this.userServices.getUserByEmail(email);
    if (!user) {
      return false;
    }
    const token = await this.userServices.insertRecoverPassword(email, user.details.name, lng);
    return token != null;
  }
}
