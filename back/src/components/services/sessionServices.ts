import UserServices from "./userServices";
import FailToBanServices from "./failToBanServices";
import { Db } from "mongodb";
import ErrorModel from "../../model/errorModel";
import MailService from "./mailServices";
import { Mail } from "../../model/mailModel";
export default class SessionServices {
  private userServices: UserServices;
  private failToBan: FailToBanServices;
  private mailService: MailService;
  constructor(db: Db) {
    this.userServices = new UserServices(db);
    this.failToBan = new FailToBanServices(db);
    this.mailService = new MailService(db);
  }

  public async login(
    email: string,
    password: string,
    rememberMe: boolean
  ): Promise<{
    userSession: any;
    sessionToken: {
      newSession: String;
      refreshToken: String;
    };
  }> {
    if (await this.userServices.checkPassword(email, password)) {
      this.failToBan.deleteIp(email);
      let userFind = await this.userServices.getUserByEmail(email);

      let sessionToken = await this.userServices.createSession(email);

      let userSession = {
        ...userFind,
        rememberMe: rememberMe,
        session: sessionToken.newSession,
        email: email,
        role: userFind?.role >= 0 && userFind?.role != undefined && userFind?.role != null ? userFind.role : 9999,
        permissions: userFind?.permissions ? userFind.permissions : [],
      };

      return { userSession, sessionToken };
    } else {
      this.failToBan.insertIp(email);
      //new Error().stack
      throw new ErrorModel(401, "Credenziali non valide. Riprova.");
    }
  }

  public async logout(email: string, session: string): Promise<void> {
    let ris = await this.userServices.deleteSession(email, session);
    if (!ris) {
      throw new ErrorModel(404, "Nessuna sessione trovata");
    }
  }

  public async recoverPassword(email: string): Promise<void> {
    let user = await this.userServices.getUserByEmail(email);
    if (user) {
      let newPassword = Array(12)
        .fill("")
        .map(() => String.fromCharCode(Math.floor(Math.random() * 26) + 97))
        .join("");
      let insert = await this.userServices.insertRecoverPassword(email, newPassword);
      if (!insert) {
        throw new ErrorModel(429, "Limite di richieste raggiunto, riprova più tardi");
      }

      this.mailService.sendMail(
        new Mail({
          to: user.email,
          type: "RECOVER_PASSWORD_ADMIN",
          bodyVariables: {
            name: user.details.name,
            mail: email,
            password: newPassword,
          },
        })
      );
    } else {
      throw new ErrorModel(404, "Utente non trovato");
    }
  }
}
