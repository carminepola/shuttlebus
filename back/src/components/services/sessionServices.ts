import UserServices from './userServices';
import FailToBanServices from './failToBanServices';
import { Db } from 'mongodb';
import ErrorModel from '../../model/errorModel';
import MailService from './mailServices';
import { role } from '../../enum/role';
import { Mail } from '../../model/mailModel';
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
    rememberMe: boolean,
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

      if (!userFind || userFind?.role == role.NO_PERMISSION) {
        throw new ErrorModel(400, 'Credenziali non valide. Riprova.');
      }

      let sessionToken = await this.userServices.createSession(email);

      if (userFind?.sessions) {
        //va oltre le possibilità del cookie
        delete userFind.sessions;
      }

      let userSession = {
        ...userFind,
        rememberMe: rememberMe,
        session: sessionToken.newSession,
        email: email,
        _id: userFind?._id,
        role: userFind?.role >= 0 && userFind?.role != undefined && userFind?.role != null ? userFind.role : 9999,
        permissions: userFind?.permissions ? userFind.permissions : [],
      };

      this.userServices.deleteOldSessions(email);

      return { userSession, sessionToken };
    } else {
      this.failToBan.insertIp(email);
      //new Error().stack
      throw new ErrorModel(400, 'Credenziali non valide. Riprova.');
    }
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

    if (userFind?.sessions) {
      //va oltre le possibilità del cookie
      delete userFind.sessions;
    }
    let sessionToken = await this.userServices.createSession(email);
    let userSession = {
      ...userFind,
      rememberMe: true,
      session: sessionToken.newSession,
      email: email,
      _id: userFind?._id,
      role: userFind?.role >= 0 && userFind?.role != undefined && userFind?.role != null ? userFind.role : 100,
      permissions: userFind?.permissions ? userFind.permissions : [],
    };

    this.userServices.deleteOldSessions(email);

    return { userSession, sessionToken };
  }

  public async loginPasskey(email: string, rememberMe: boolean): Promise<{
    userSession: any;
    sessionToken: {
      newSession: String;
      refreshToken: String;
    };
  }> {
    this.failToBan.deleteIp(email);
    let userFind = await this.userServices.getUserByEmail(email);

    if (!userFind || userFind?.role == role.NO_PERMISSION) {
      throw new ErrorModel(400, 'Credenziali non valide. Riprova.');
    }

    let sessionToken = await this.userServices.createSession(email);

    if (userFind?.sessions) {
      delete userFind.sessions;
    }

    let userSession = {
      ...userFind,
      rememberMe: rememberMe,
      session: sessionToken.newSession,
      email: email,
      _id: userFind?._id,
      role: userFind?.role >= 0 && userFind?.role != undefined && userFind?.role != null ? userFind.role : 9999,
      permissions: userFind?.permissions ? userFind.permissions : [],
    };

    this.userServices.deleteOldSessions(email);

    return { userSession, sessionToken };
  }

  public async logout(email: string, session: string): Promise<void> {
    let ris = await this.userServices.deleteSession(email, session);
    if (!ris) {
      throw new ErrorModel(404, 'Nessuna sessione trovata');
    }
  }

  public async recoverPassword(email: string, lng: string): Promise<void> {
    let user = await this.userServices.getUserByEmail(email);
    if (user) {
      let newPassword = Array(12)
        .fill('')
        .map(() => String.fromCharCode(Math.floor(Math.random() * 26) + 97))
        .join('');
      let insert = await this.userServices.insertRecoverPassword(email, newPassword);
      if (!insert) {
        throw new ErrorModel(429, 'str_limite_raggiunto');
      }

      this.mailService.sendMail(
        new Mail({
          to: user.email,
          type: 'RECOVER_PASSWORD',
          bodyVariables: {
            name: user.details.name,
            mail: email,
            password: newPassword,
          },
        }),
      );
    }
  }
}
