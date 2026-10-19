import { Db } from "mongodb";
import UsersDao from "../dao/usersDao";
import userModel from "../../model/userModel";
import { role } from "../../enum/role";
import ErrorModel from "../../model/errorModel";
import MailSenderServices from "./mailSender";
import { logger } from "../..";

import * as CryptoJS from "crypto-js";

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
  async getUserByEmailAll(email: string) {
    try {
      const result = await this.userDao.getUserByEmailAll(email);
      return result;
    } catch (error) {
      throw error;
    }
  }
  async getUsers(page: number = 1, limit: number = 10) {
    try {
      const result = await this.userDao.getUsers(page, limit);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async searchUsers(searchTerm: string, page: number = 1, limit: number = 10) {
    try {
      const result = await this.userDao.searchUsers(searchTerm, page, limit);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async getStaff(page: number = 1, limit: number = 10) {
    try {
      const result = await this.userDao.getStaff(page, limit);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async searchStaff(searchTerm: string, page: number = 1, limit: number = 10) {
    try {
      const result = await this.userDao.searchStaff(searchTerm, page, limit);
      return result;
    } catch (error) {
      throw error;
    }
  }

  async getNoPermissionUsers(searchTerm?: string, page: number = 1, limit: number = 10) {
    try {
      const result = await this.userDao.getNoPermissionUsers(page, limit, searchTerm);
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

  async changePassword(user: { email: string; password: string; oldPassword: string; session?: string }) {
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

  async updateUserDetails(email: string, name: string, phone?: string) {
    try {
      const userData = await this.userDao.getUserByEmailAll(email);
      if (!userData) {
        throw new ErrorModel(404, "Utente non trovato");
      }

      const updateData: any = {};
      updateData["details.name"] = name;
      if (phone !== undefined) {
        updateData["details.phone"] = phone;
      }

      const result = await this.userDao.updateUserDetails(email, updateData);
      return result;
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
  generatePin() {
    // Usa un valore casuale (puoi anche usare Date.now o simili come seed)
    const randomBytes = CryptoJS.lib.WordArray.random(4); // 4 byte = 32 bit

    // Convertilo in un numero usando l'hash (puoi anche usare direttamente il valore raw)
    const hash = CryptoJS.SHA256(randomBytes).toString(CryptoJS.enc.Hex);

    // Prendi solo una parte dell'hash per ottenere un numero
    const number = parseInt(hash.slice(0, 8), 16); // Primi 8 caratteri = 32 bit

    // Riduci a un numero tra 0 e 999999
    const pin = number % 1000000;

    // Ritorna una stringa con zeri iniziali se necessario
    return pin.toString().padStart(6, "0");
  }
  async register(user: userModel, lng: string) {
    try {
      let oldUser = await this.userDao.getUserByEmailAll(user.email);
      if (oldUser && oldUser.role !== role.NO_PERMISSION) {
        throw new ErrorModel(409, "Utente già esistente");
      } else {
        if (oldUser) {
          await this.deleteUser(user.email);
        }
        user.options.pin = this.generatePin();

        // Crea prima l'utente nel database
        let result = await this.createUser(user);

        // Poi invia l'email (se fallisce, l'utente esiste comunque e può richiedere un nuovo PIN)
        try {
          await this.mailSenderServices.sendWelcomeMail(user.email, user.details.name || "Utente", user.options.pin, user.email, lng);
        } catch (mailError) {
          logger.error(`Errore invio email di benvenuto a ${user.email}:`, mailError);
          // Non blocchiamo la registrazione se l'email fallisce
        }

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
  async insertRecoverPassword(email: string, username: string, lng: string = "it"): Promise<string | null> {
    try {
      // Flusso TOKEN: ritorna il token plain per la mail, null se rate limit raggiunto.
      // Nessuna password in chiaro viene generata piu'.
      return await this.userDao.insertRecoverPassword(email, username, lng);
    } catch (error) {
      throw error;
    }
  }
  async updateOptions(email: string, key: string, value: string): Promise<boolean> {
    try {
      // pentest: mass-assignment — prima veniva scritto QUALSIASI campo options
      // (incluso options.pin, che e' un dato sensibile di validazione). Solo chiavi
      // di presentazione sono modificabili dal cliente.
      const ALLOWED_KEYS = new Set(["lng", "theme"]);
      if (!ALLOWED_KEYS.has(key)) {
        logger.warn(`Tentativo di aggiornare opzione non consentita: "${key}" per ${email}`);
        return false;
      }
      return await this.userDao.updateOptions(email, key, value);
    } catch (error) {
      throw error;
    }
  }

  /** Invalida il PIN di verifica email in attesa (bruteforce PIN). */
  async clearPendingPin(email: string): Promise<boolean> {
    try {
      return await this.userDao.clearPendingPin(email);
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
  async updateRoleByEmail(email: string, newRole: role): Promise<boolean> {
    try {
      return await this.userDao.updateRoleByEmail(email, newRole);
    } catch (error) {
      throw error;
    }
  }
  async updateGoogleInfo(email: string, googleInfo: any) {
    try {
      let google = {
        photos: googleInfo.photos,
        email: googleInfo.email,
        displayName: googleInfo.displayName,
        id: googleInfo.id,
      };
      return await this.userDao.updateGoogleInfo(email, google);
    } catch (error) {
      throw error;
    }
  }
  /**
   * SSO: update profilo per provider OAuth (firma identica a google/microsoft).
   * La whitelist del provider sta nel DAO (nessuna composizione libera di path).
   */
  async updateOAuthInfo(email: string, provider: "google" | "microsoft" | "facebook" | "spotify", info: any) {
    try {
      return await this.userDao.updateOAuthInfo(email, provider, info);
    } catch (error) {
      throw error;
    }
  }
  async updateMicrosoftInfo(email: string, microsoftInfo: any) {
    try {
      let microsoft = {
        photos: microsoftInfo.photos,
        email: microsoftInfo.email,
        displayName: microsoftInfo.displayName,
        id: microsoftInfo.id,
      };
      return await this.userDao.updateMicrosoftInfo(email, microsoft);
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
  async deleteUserById(id: string): Promise<boolean> {
    try {
      return await this.userDao.deleteUserById(id);
    } catch (error) {
      throw error;
    }
  }
  async validateEmail(email: string, pin: string): Promise<boolean> {
    try {
      let u = await this.userDao.getUserByEmailNotPermission(email);
      if (!u) {
        // pentest: era 404 "Utente non trovato" → enumerazione account.
        // Stesso errore generico del PIN errato.
        throw new ErrorModel(400, "Pin non valido");
      }
      let user = new userModel(u);

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

  async updateRole(userId: string, newRole: number) {
    const validRoles = [role.ADMIN, role.DRIVER, role.USER, role.NO_PERMISSION];
    if (!validRoles.includes(newRole)) {
      throw new ErrorModel(400, "Ruolo non valido");
    }
    const user = await this.userDao.getUserById(userId);
    if (!user) {
      throw new ErrorModel(404, "Utente non trovato");
    }
    const oldRole = user.role;
    user.role = newRole;
    await this.userDao.updateUser(user);
    return { oldRole, newRole };
  }

  async updateUserDetailsById(userId: string, name: string, phone?: string) {
    const userData = await this.userDao.getUserById(userId);
    if (!userData) {
      throw new ErrorModel(404, "Utente non trovato");
    }

    const updateData: any = {};
    updateData["details.name"] = name;
    if (phone !== undefined) {
      updateData["details.phone"] = phone;
    }

    const result = await this.userDao.updateUserDetailsById(userId, updateData);
    return result;
  }
}
