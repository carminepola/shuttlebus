import { Db, ObjectId } from "mongodb";
import { logger } from "../../index";
import bcrypt from "bcrypt";
import { Guid } from "guid-typescript";
import userModel from "../../model/userModel";
import sessionModel from "../../model/sessionModel";
import * as CryptoJS from "crypto-js";
import ErrorModel from "../../model/errorModel";
import { role } from "../../enum/role";
import MailSenderServices from "../services/mailSender";
export default class UsersDao {
  db: Db;
  schema: string = "users";
  loggerInfo: any;
  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Retrieves all users from the database.
   *
   * @returns {Promise<any[]>} - A promise that resolves to an array of user objects.
   * Each user object has its password field removed for security purposes.
   * @throws {Error} - Throws an error if there is an issue querying the database.
   */

  async getUsers(page: number = 1, limit: number = 10) {
    try {
      let json = {
        role: { $eq: role.USER },
      };
      const skip = (page - 1) * limit;
      let list = await this.db.collection(this.schema).find(json).skip(skip).limit(limit).toArray();
      list.forEach((element) => {
        delete element.password;
        delete element.recoverPassword;
        delete element.recoverPasswordCount;
        delete element?.options?.google?._raw;
        delete element?.options?.google?._json;
      });

      // Get total count for pagination
      const totalCount = await this.db.collection(this.schema).countDocuments(json);

      return {
        users: list,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async searchUsers(searchTerm: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      const searchRegex = new RegExp(searchTerm, "i");

      let json = {
        role: { $eq: role.USER },
        $or: [{ "details.name": { $regex: searchRegex } }, { email: { $regex: searchRegex } }],
      };

      let list = await this.db.collection(this.schema).find(json).sort({ _id: -1 }).skip(skip).limit(limit).toArray();
      list = list.map((user) => {
        delete user.password;
        delete user.recoverPassword;
        delete user.recoverPasswordCount;
        delete user?.options?.google?._raw;
        delete user?.options?.google?._json;

        return {
          _id: user._id,
          name: user.details?.name || "",
          email: user.email,
          phone: user.details?.phone || "",
          pin: user.options?.pin || "",
        };
      });

      const totalCount = await this.db.collection(this.schema).countDocuments(json);

      return {
        users: list,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getStaff(page: number = 1, limit: number = 10) {
    try {
      let json = {
        role: { $lt: role.USER },
      };
      const skip = (page - 1) * limit;
      let list = await this.db.collection(this.schema).find(json).skip(skip).limit(limit).toArray();
      list.forEach((element) => {
        delete element.password;
        delete element.recoverPassword;
        delete element.recoverPasswordCount;
        delete element?.options?.google?._raw;
        delete element?.options?.google?._json;
      });

      const totalCount = await this.db.collection(this.schema).countDocuments(json);

      return {
        users: list,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async searchStaff(searchTerm: string, page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      const searchRegex = new RegExp(searchTerm, "i");

      let json = {
        role: { $lt: role.USER },
        $or: [{ "details.name": { $regex: searchRegex } }, { email: { $regex: searchRegex } }],
      };

      let list = await this.db.collection(this.schema).find(json).sort({ _id: -1 }).skip(skip).limit(limit).toArray();
      list = list.map((user) => {
        delete user.password;
        delete user.recoverPassword;
        delete user.recoverPasswordCount;
        delete user?.options?.google?._raw;
        delete user?.options?.google?._json;

        return {
          _id: user._id,
          name: user.details?.name || "",
          email: user.email,
          phone: user.details?.phone || "",
          pin: user.options?.pin || "",
        };
      });

      const totalCount = await this.db.collection(this.schema).countDocuments(json);

      return {
        users: list,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }

  async getNoPermissionUsers(page: number = 1, limit: number = 10, searchTerm?: string) {
    try {
      const skip = (page - 1) * limit;
      let json: any = {
        role: { $eq: role.NO_PERMISSION },
      };
      if (searchTerm) {
        const searchRegex = new RegExp(searchTerm, "i");
        json.$or = [{ "details.name": { $regex: searchRegex } }, { email: { $regex: searchRegex } }];
        json.role = { $eq: role.NO_PERMISSION };
      }
      const totalCount = await this.db.collection(this.schema).countDocuments(json);
      let list = await this.db.collection(this.schema).find(json).sort({ _id: -1 }).skip(skip).limit(limit).toArray();
      list = list.map((user) => {
        delete user.password;
        delete user.recoverPassword;
        delete user.recoverPasswordCount;
        delete user?.options?.google?._raw;
        delete user?.options?.google?._json;
        return {
          _id: user._id,
          name: user.details?.name || "",
          email: user.email,
          phone: user.details?.phone || "",
          pin: user.options?.pin || "",
        };
      });
      return {
        users: list,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      throw error;
    }
  }
  /**
   * Retrieves a user from the database by its id.
   *
   * @param {string} id - The id of the user to retrieve.
   * @returns {Promise<any[]>} - A promise that resolves to an array containing the user object.
   * The user object has its password field removed for security purposes.
   * @throws {Error} - Throws an error if there is an issue querying the database.
   */
  async getUserById(id: string) {
    try {
      let json = {};
      if (id) {
        json = {
          _id: new ObjectId(id),
        };
      }
      let element = await this.db.collection(this.schema).findOne(json);

      delete element?.password;
      delete element?.recoverPassword;
      delete element?.recoverPasswordCount;
      delete element?.options?.google?._raw;
      delete element?.options?.google?._json;

      return element;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Retrieves a user from the database by its email.
   *
   * @param {string} email - The email of the user to retrieve.
   * @returns {Promise<any[]>} - A promise that resolves to an array containing the user object.
   * The user object has its password field removed for security purposes.
   * @throws {Error} - Throws an error if there is an issue querying the database.
   */
  async getUserByEmail(email: string) {
    try {
      email = email.toLowerCase();
      let json = {};
      json = {
        email: email,
        role: { $ne: role.NO_PERMISSION },
      };
      let element = await this.db.collection(this.schema).findOne(json);
      delete element?.password;
      delete element?.recoverPassword;
      delete element?.recoverPasswordCount;
      1;
      return element;
    } catch (error) {
      throw error;
    }
  }
  async getUserByEmailAll(email: string) {
    try {
      email = email.toLowerCase();
      let json = {};
      json = {
        email: email,
      };
      let element = await this.db.collection(this.schema).findOne(json);
      delete element?.password;
      delete element?.recoverPassword;
      delete element?.recoverPasswordCount;
      delete element?.options?.google?._raw;
      delete element?.options?.google?._json;

      return element;
    } catch (error) {
      throw error;
    }
  }
  async getUserByEmailNotPermission(email: string) {
    try {
      email = email.toLowerCase();
      let json = {};
      json = {
        email: email,
        role: { $eq: role.NO_PERMISSION },
      };
      let element = await this.db.collection(this.schema).findOne(json);
      delete element?.password;
      delete element?.recoverPassword;
      delete element?.recoverPasswordCount;
      delete element?.options?.google?._raw;
      delete element?.options?.google?._json;

      return element;
    } catch (error) {
      throw error;
    }
  }
  /**
   * Retrieves the role and permissions of a user from the database by its email.
   *
   * @param {string} email - The email of the user to retrieve.
   * @returns {Promise<{role: number, permissions: string[]}>} - A promise that resolves to an object containing the role and permissions of the user.
   * @throws {Error} - Throws an error if there is an issue querying the database.
   */
  async getUserPermissionsFormEmail(email: string) {
    try {
      email = email.toLowerCase();
      let user = await this.db.collection(this.schema).findOne(
        {
          email: email,
        },
        { projection: { permissions: 1, role: 1, _id: 0, options: 1, details: 1 } },
      );

      return user;
    } catch (error) {
      throw error;
    }
  }
  async setFalseUserPermissions(email: string, session: string) {
    try {
      email = email.toLowerCase();
      let user = await this.db.collection(this.schema).findOneAndUpdate(
        {
          email: email,
          "sessions.id": session,
        },
        {
          $set: {
            "sessions.$.update": false,
          },
        },
      );

      return user;
    } catch (error) {
      throw error;
    }
  }
  /**
   * Verifies the password for a user in the database.
   *
   * @param {string} email - The email of the user to verify the password for.
   * @param {string} password - The password to verify.
   * @returns {Promise<boolean>} - A promise that resolves to true if the password is valid, false otherwise.
   * @throws {Error} - Throws an error if there is an issue querying the database.
   */
  async checkPassword(email: string, password: string): Promise<boolean> {
    try {
      email = email.toLowerCase();
      let json = {};
      json = {
        email: email,
        disabled: false,
      };
      let user = await this.db.collection(this.schema).findOne(json);

      if (user) {
        let res = bcrypt.compareSync(password, user.password);
        if (user.recoverPassword && !res) {
          let today = new Date().getTime();
          let lastUpdate = user.recoverPasswordLastUpdate ? user.recoverPasswordLastUpdate : undefined;
          if (lastUpdate && today - lastUpdate > 1000 * 60 * 60 * 24) {
            return false;
          } else {
            res = bcrypt.compareSync(password, user.recoverPassword);
            if (res) {
              await this.db.collection(this.schema).updateOne(
                { email: email },
                {
                  $set: {
                    recoverPassword: null,
                    password: user.recoverPassword,
                  },
                },
              );
            }
          }
        }
        return res;
      }

      return false;
    } catch (error) {
      throw error;
    }
  }

  generateSecurePassword() {
    const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = CryptoJS.lib.WordArray.random(6); // 6 byte = 6 caratteri
    let password = "";

    for (let i = 0; i < 6; i++) {
      // Usa ogni byte per indicizzare nel charset
      const byte = bytes.words[Math.floor(i / 4)] >>> (24 - 8 * (i % 4));
      password += charset.charAt(byte % charset.length);
    }

    return password;
  }
  async insertRecoverPassword(email: string, username: string, lng: string): Promise<boolean> {
    try {
      email = email.toLowerCase();
      const password = this.generateSecurePassword();

      const today = new Date().getTime();
      const user = await this.db.collection(this.schema).findOne({ email: email });
      const count = user?.recoverPasswordCount || 0;
      const lastUpdate = user?.recoverPasswordLastUpdate ? new Date(user.recoverPasswordLastUpdate).setHours(0, 0, 0, 0) : 0;
      const startToday = new Date().setHours(0, 0, 0, 0);
      const newCount = lastUpdate && lastUpdate == startToday ? count + 1 : 1;
      if (newCount >= 3) {
        return false;
      }

      let crypto = bcrypt.hashSync(CryptoJS.MD5(password).toString(), 10);

      await this.db.collection(this.schema).updateOne(
        { email: email },
        {
          $set: {
            recoverPassword: crypto,
            recoverPasswordCount: newCount,
            recoverPasswordLastUpdate: today,
          },
        },
      );
      const mailSenderServices: MailSenderServices = new MailSenderServices(this.db);

      mailSenderServices.sendRecoverPassword(email, username, password, lng);
    } catch (error) {
      throw error;
    }
    return true;
  }

  async updateOptions(email: string, key: string, value: string): Promise<boolean> {
    try {
      email = email.toLowerCase();
      await this.db.collection(this.schema).updateOne(
        { email: email },
        {
          $set: {
            options: {
              [key]: value,
            },
            "sessions.$[].update": true,
          },
        },
      );
    } catch (error) {
      throw error;
    }
    return true;
  }
  /**
   * Inserts a new user in the database.
   *
   * @param {any} user - The new user to insert. The password will be hashed before insertion.
   * @returns {Promise<any>} - A promise that resolves to the inserted user object with _id and without password.
   * @throws {Error} - Throws an error if there is an issue querying the database.
   */
  async createUser(user: any) {
    try {
      user.email = user.email.toLowerCase();
      if (!user.password) {
        user.password = this.generateSecurePassword();
      }
      user.password = bcrypt.hashSync(user.password, 10);
      const result = await this.db.collection(this.schema).insertOne(user);
      if (result && result.insertedId) {
        user._id = result.insertedId;
        delete user.password;
        return user;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }
  /**
   * Updates the password for a user in the database.
   *
   * @param {any} user - The user object containing the email and new password.
   *                     The password will be hashed before updating.
   * @returns {Promise<any>} - A promise that resolves to the updated user object without the password and oldPassword fields.
   * @throws {Error} - Throws an error if there is an issue updating the database.
   */
  async updatePassword(user: any) {
    try {
      user.email = user.email.toLowerCase();
      user.password = bcrypt.hashSync(user.password, 10);
      const result = await this.db.collection(this.schema).findOneAndUpdate({ email: user.email }, { $set: { password: user.password } });
      if (result) {
        delete user.password;
        delete user.oldPassword;
        return user;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Creates a new session for a user in the database or updates the existing one.
   *
   * @param {string} email - The email of the user to create or update a session for.
   * @returns {Promise<string>} - A promise that resolves to the id of the new session.
   * @throws {Error} - Throws an error if there is an issue updating the database.
   */
  async createSession(email: string): Promise<{ newSession: String; refreshToken: String }> {
    try {
      email = email.toLowerCase();
      let newSession = Guid.create().toString();
      let refreshToken = Guid.create().toString();
      const result = await this.db.collection<userModel>(this.schema).updateOne(
        { email: email },
        {
          $push: {
            sessions: {
              $each: [
                {
                  id: newSession,
                  update: false,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                  refreshToken: refreshToken,
                },
              ],
            },
          },
        },
      );
      if (result.modifiedCount > 0) {
        logger.info(`Sessione aggiunta per l'utente ${email}, sessione: ${newSession}`, this.loggerInfo);
        return { newSession, refreshToken };
      } else {
        throw new ErrorModel(500, "Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deletes a session for a user in the database.
   *
   * @param {string} email - The email of the user whose session is to be deleted.
   * @param {string} sessionId - The ID of the session to be deleted.
   * @returns {Promise<number>} - A promise that resolves to 1 if the session was successfully deleted,
   *                              or 0 if no session was found and deleted.
   * @throws {Error} - Throws an error if there is an issue updating the database.
   */
  async deleteSession(email: string, sessionId: string): Promise<boolean> {
    try {
      email = email.toLowerCase();
      const result = await this.db.collection<userModel>(this.schema).updateOne(
        { email: email },
        {
          $pull: {
            sessions: { id: sessionId }, // Rimuove l'oggetto che ha il campo id uguale a sessionId
          },
        },
      );
      if (result.modifiedCount > 0) {
        logger.info(`Sessione rimossa per l'utente ${email}, session: ${sessionId}`, this.loggerInfo);
        return true;
      } else {
        return false;
      }
    } catch (error) {
      throw error;
    }
  }
  async deleteOldSessions(email: string): Promise<boolean> {
    try {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      email = email.toLowerCase();
      // Rimuove sessioni più vecchie di 30 giorni
      await this.db.collection<userModel>(this.schema).updateOne(
        { email: email },
        {
          $pull: { sessions: { updatedAt: { $lte: thirtyDaysAgo } } },
        },
      );

      // Ottieni le sessioni attuali ordinate per data (dal più recente al più vecchio)
      const user = await this.db.collection<userModel>(this.schema).findOne({ email: email }, { projection: { sessions: 1 } });

      if (user && user.sessions.length > 5) {
        // Tieni solo le ultime 10 sessioni ordinate per updatedAt
        const recentSessions = user.sessions.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

        // Sostituisci l'array delle sessioni con i soli ultimi 10 elementi
        await this.db.collection<userModel>(this.schema).updateOne({ email: email }, { $set: { sessions: recentSessions } });
      }

      logger.info(`Sessioni aggiornate per l'utente ${email}, mantenendo solo le ultime 5`, this.loggerInfo);
      return true;
    } catch (error) {
      throw error;
    }
  }
  async checkSession(email: string, sessionID: string): Promise<number> {
    try {
      email = email.toLowerCase();
      // Esegui la query per trovare e aggiornare la sessione
      const result = await this.db.collection(this.schema).findOneAndUpdate(
        {
          email: email,
          "sessions.id": sessionID, // Cerca la sessione per email e sessionID
        },
        {
          $set: {
            "sessions.$.updatedAt": new Date().getTime(), // Aggiorna l'updatedAt della sessione
          },
        },
      );

      // Verifica se `result` è nullo o se `result.value` è nullo
      if (!result) {
        return 0; // Utente o sessione non trovata
      }

      const session = result.sessions.find((s: sessionModel) => s.id === sessionID); // La sessione si trova all'indice 0

      if (!session) {
        return 0; // La sessione non è stata trovata, quindi non fare nulla
      }

      if (session.update) {
        return 2;
      } else {
        return 1;
      }
    } catch (error) {
      console.error("Errore durante l'operazione:", error);
      throw error; // Rilancia l'errore
    }
  }
  /**
   * Controlla se il token di refresh e la sessione sono validi e restituisce
   * true se il token di refresh e la sessione sono validi
   * false se il token di refresh o la sessione non sono validi
   * @param {string} email - L'email dell'utente
   * @param {string} refreshToken - Il token di refresh da controllare
   * @param {string} userSession - La sessione da controllare
   * @returns {boolean} - true se il token di refresh e la sessione sono validi, false se non lo sono
   */
  async checkRefreshTokenAndSession(email: string, refreshToken: string, userSession: string): Promise<boolean> {
    try {
      email = email.toLowerCase();
      // Esegui la query per trovare e controllare la sessione
      const result = await this.db.collection(this.schema).findOne({
        email: email,
        sessions: { $elemMatch: { id: userSession, refreshToken: refreshToken } },
      });

      // Verifica se `result` è nullo o se `result.value` è nullo
      if (!result) {
        return false; // Utente o sessione non trovata
      }

      return true;
    } catch (error) {
      console.error("Errore durante l'operazione:", error);
      throw error; // Rilancia l'errore
    }
  }

  /**
   * Deletes all sessions for a user except the current session in the database.
   *
   * @param {string} email - The email of the user whose sessions are to be deleted.
   * @param {string} currentSessionId - The ID of the current session that should not be deleted.
   * @returns {Promise<number>} - A promise that resolves to the number of sessions deleted.
   * @throws {Error} - Throws an error if there is an issue updating the database.
   */
  async deleteAllExceptCurrentSession(email: string, currentSessionId: string): Promise<number> {
    try {
      email = email.toLowerCase();
      // Verifica e rimuove tutte le sessioni tranne quella corrente
      const result = await this.db.collection<userModel>(this.schema).updateMany(
        {
          email: email, // Cerca il documento con l'email corrispondente
          sessions: { $exists: true }, // Assicurati che il campo `sessions` esista
        },
        {
          $pull: {
            sessions: { id: { $ne: currentSessionId } }, // Rimuovi tutte le sessioni con id diverso dal corrente
          },
        },
      );

      // Ritorna il numero di documenti modificati
      return result.modifiedCount;
    } catch (error) {
      console.error("Errore durante l'eliminazione delle sessioni:", error);
      throw new Error("Errore nell'eliminazione delle sessioni");
    }
  }
  /**
   * Restituisce gli utenti con un ruolo specifico
   * @param {role} role - Il ruolo da cercare
   * @returns {Promise<userModel[]>} - Un array di utenti con il ruolo selezionato
   */
  async getUsersByListOfRole(role: role[]): Promise<userModel[]> {
    try {
      // Trova tutti gli utenti con il ruolo selezionato
      const result = await this.db.collection<userModel>(this.schema).find({ disabled: false, isDeleted: false, role: { $in: role } });
      // Ritorna l'array di utenti
      return result.toArray();
    } catch (error) {
      console.error("Errore durante la ricerca degli utenti con il ruolo selezionato:", error);
      throw error; // Rilancia l'errore
    }
  }
  async updateGoogleInfo(email: string, googleInfo: any) {
    try {
      email = email.toLowerCase();
      // Aggiorna la sessione google dell'utente
      const result = await this.db.collection<userModel>(this.schema).updateOne(
        {
          email: email,
        },
        {
          $set: {
            "options.google": googleInfo,
          },
        },
      );

      // Verifica se `result` è nullo o se `result.value` è nullo
      if (!result) {
        throw new Error("Utente non trovato");
      }

      return result.modifiedCount;
    } catch (error) {
      console.error("Errore durante l'aggiornamento della sessione google:", error);
      throw error; // Rilancia l'errore
    }
  }
  async getUsersByRole(role: role): Promise<userModel[]> {
    try {
      // Trova tutti gli utenti con il ruolo selezionato
      const result = await this.db.collection<userModel>(this.schema).find({ disabled: false, role: role }, { projection: { email: 1, details: 1, name: 1, surname: 1, role: 1, permissions: 1 } });
      // Ritorna l'array di utenti
      return result.toArray();
    } catch (error) {
      console.error("Errore durante la ricerca degli utenti con il ruolo selezionato:", error);
      throw error; // Rilancia l'errore
    }
  }
  async deleteUser(email: string): Promise<boolean> {
    try {
      email = email.toLowerCase();
      // Cancella l'utente
      const result = await this.db.collection<userModel>(this.schema).deleteOne({ email: email });
      // Verifica se `result` è nullo o se `result.value` è nullo
      if (!result) {
        throw new Error("Utente non trovato");
      }
      return true;
    } catch (error) {
      console.error("Errore durante la cancellazione dell'utente:", error);
      throw error; // Rilancia l'errore
    }
    return false;
  }
  async validateEmail(email: string): Promise<void> {
    try {
      email = email.toLowerCase();
      // Trova l'utente con l'email specificata
      const result = await this.db.collection<userModel>(this.schema).updateOne(
        { email: email },
        {
          $set: {
            "options.pin": "",
          },
        },
      );
      // Verifica se `result`è nullo o se `result.value`è nullo
      if (!result) {
        return; // L'utente non esiste
      }
    } catch (error) {
      throw error;
    }
  }
  async updateUser(user: any): Promise<boolean> {
    try {
      // Aggiorna l'utente

      user.email = user.email.toLowerCase();
      if (!user.password) {
        delete user.password;
      }

      const result = await this.db.collection<userModel>(this.schema).updateOne({ email: user.email }, { $set: user });
      // Verifica se `result`è nullo o se `result.value`è nullo
      if (!result) {
        throw new Error("Utente non trovato");
      }
      return true;
    } catch (error) {
      console.error("Errore durante l'aggiornamento dell'utente:", error);
      throw error; // Rilancia l'errore
    }
  }

  async updateUserDetails(email: string, updateData: any): Promise<boolean> {
    try {
      email = email.toLowerCase();
      const result = await this.db.collection<userModel>(this.schema).updateOne({ email: email }, { $set: updateData });
      if (!result) {
        throw new Error("Utente non trovato");
      }
      return true;
    } catch (error) {
      console.error("Errore durante l'aggiornamento dei dettagli dell'utente:", error);
      throw error;
    }
  }

  async updateUserDetailsById(userId: string, updateData: any): Promise<boolean> {
    try {
      const result = await this.db.collection<userModel>(this.schema).updateOne({ _id: new ObjectId(userId) }, { $set: updateData });
      if (!result) {
        throw new Error("Utente non trovato");
      }
      return true;
    } catch (error) {
      console.error("Errore durante l'aggiornamento dei dettagli dell'utente per ID:", error);
      throw error;
    }
  }
  async acceptTerms(id: string): Promise<boolean> {
    try {
      this.db.collection<userModel>(this.schema).updateOne({ _id: new ObjectId(id) }, { $set: { privacyAndPolicy: true, privacyAndPolicyConfirmDate: new Date().getTime() } });
      return true;
    } catch (error) {
      console.error("Errore durante l'aggiornamento dell'utente:", error);
      throw error; // Rilancia l'errore
    }
  }
}
