import { Db } from "mongodb";
import UsersDao from "../dao/usersDao";
import userModel from "../../model/userModel";
import { role } from "../../enum/role";
import ErrorModel from "../../model/errorModel";
import MailSenderServices from "./mailSender";

export default class UserServices {
  private userDao: UsersDao;
  private mailSenderServices: MailSenderServices;
  constructor(db: Db) {
    this.userDao = new UsersDao(db);
    this.mailSenderServices = new MailSenderServices(db);
  }

  async getUserById(id: string) {
    try {
      const result = await this.userDao.getUserById(id);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async getUserByEmail(email: string) {
    try {
      const result = await this.userDao.getUserByEmail(email);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async getUsers() {
    try {
      const result = await this.userDao.getUsers();
      return result;
    } catch (error) {
      throw error;
    }
  }

  async createUser(user: userModel) {
    try {
      let oldUser = await this.userDao.getUserByEmail(user.email);
      if (oldUser) {
        throw new ErrorModel(409, "Utente già esistente");
      } else {
        const result = await this.userDao.createUser(user);
        return result;
      }
    } catch (error) {
      throw error;
    }
  }

  async changePassword(user: { email: string; password: string; oldPassword: string }) {
    try {
      if (await this.userDao.checkPassword(user.email, user.oldPassword)) {
        const result = await this.userDao.updatePassword(user);
        return result;
      } else {
        throw new ErrorModel(400, "Password errata");
      }
    } catch (error) {
      throw error;
    }
  }
  async checkPassword(email: string, password: string) {
    try {
      return await this.userDao.checkPassword(email, password);
    } catch (error) {
      throw error;
    }
  }
  async createSession(email: string): Promise<{ newSession: String; refreshToken: String }> {
    try {
      return await this.userDao.createSession(email);
    } catch (error) {
      throw error;
    }
  }

  async register(user: userModel, lng: string) {
    try {
      let oldUser = await this.userDao.getUserByEmail(user.email);
      if (oldUser && user.role !== role.NO_PERMISSION) {
        throw new ErrorModel(409, "Utente già esistente");
      } else {
        if (oldUser) {
          await this.deleteUser(user.email);
        }

        await this.mailSenderServices.sendWelcomeMail(user.email, user.details.name || "Utente", user.options.pin, user.email, lng);

        let result = await this.createUser(user);
        return result;
      }
    } catch (error) {
      throw error;
    }
  }
  async deleteSession(email: string, sessionId: string): Promise<boolean> {
    try {
      return await this.userDao.deleteSession(email, sessionId);
    } catch (error) {
      throw error;
    }
  }
  async insertRecoverPassword(email: string, password: string, lng: string = "it"): Promise<boolean> {
    try {
      return await this.userDao.insertRecoverPassword(email, password, lng);
    } catch (error) {
      throw error;
    }
  }
  async updateOptions(email: string, key: string, value: string): Promise<boolean> {
    try {
      return await this.userDao.updateOptions(email, key, value);
    } catch (error) {
      throw error;
    }
  }
  async deleteOldSessions(email: string): Promise<boolean> {
    try {
      return await this.userDao.deleteOldSessions(email);
    } catch (error) {
      throw error;
    }
  }
  async getNormalUser() {
    try {
      let allUsers = await this.userDao.getUsersByRole(role.USER);
      let normalUsers = allUsers.map((user) => {
        return {
          photo: user.options?.google?.photos[0].value || "",
          name: user.details.name,
          email: user.email,
          phone: user.details.phone || "",
        };
      });
      return normalUsers;
    } catch (error) {
      throw error;
    }
  }
  async updateGoogleInfo(email: string, googleInfo: any) {
    try {
      return await this.userDao.updateGoogleInfo(email, googleInfo);
    } catch (error) {
      throw error;
    }
  }
  async deleteUser(email: string): Promise<boolean> {
    try {
      return await this.userDao.deleteUser(email);
    } catch (error) {
      throw error;
    }
  }
  async validateEmail(email: string, pin: string): Promise<boolean> {
    try {
      let u = await this.userDao.getUserByEmail(email);
      let user = new userModel(u);

      if (!user) {
        throw new ErrorModel(404, "Utente non trovato");
      }
      if (user.options.pin == "" || Number(user.options.pin) !== Number(pin)) {
        throw new ErrorModel(400, "Pin non valido");
      } else {
        user.options.pin = "";
      }
      user.role = role.USER;

      await this.userDao.updateUser(user);
      return true;
    } catch (error) {
      throw error;
    }
    return false;
  }
  async acceptTerms(id: string) {
    try {
      let u = await this.userDao.acceptTerms(id);

      return true;
    } catch (error) {
      throw error;
    }
    return false;
  }
}
