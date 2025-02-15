import { Db } from "mongodb";
import UsersDao from "../dao/usersDao";
import userModel from "../../model/userModel";
import ErrorModel from "../../model/errorModel";
export default class UserServices {
  private userDao: UsersDao;
  constructor(db: Db) {
    this.userDao = new UsersDao(db);
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

  async deleteSession(email: string, sessionId: string): Promise<boolean> {
    try {
      return await this.userDao.deleteSession(email, sessionId);
    } catch (error) {
      throw error;
    }
  }
  async insertRecoverPassword(email: string, password: string): Promise<boolean> {
    try {
      return await this.userDao.insertRecoverPassword(email, password);
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
}
