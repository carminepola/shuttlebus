import { Db, ObjectId } from "mongodb";
import { logger } from "../..";
import bcrypt from "bcrypt";
import { Guid } from "guid-typescript";
import userModel from "../../interface/userModel";
import sessionModel from "../../interface/sessionModel";

export default class UsersDao {
  db: Db;
  schema: string = "users";
  loggerInfo: any;
  constructor(db: Db, loggerInfo?: any) {
    this.db = db;
    this.loggerInfo = loggerInfo ? loggerInfo : {};
  }

  /*************  ✨ Codeium Command ⭐  *************/
  /**
   * Retrieves all users from the database.
   * 
   * @returns {Promise<any[]>} - A promise that resolves to an array of user objects. 
   * Each user object has its password field removed for security purposes.
   * @throws {Error} - Throws an error if there is an issue querying the database.
   */
  /******  9cc371dc-25fc-4291-9938-872e0ba45c3e  *******/
  async readAllUsers() {
    try {

      let json = {};
      let list = await this.db.collection(this.schema).find(json).toArray();
      list.forEach((element) => {
        delete element.password;
      });
      return list;
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
  async readUserById(id: string) {
    try {
      let json = {};
      if (id) {
        json = {
          _id: new ObjectId(id),
        };
      }
      let list = await this.db.collection(this.schema).find(json).toArray();
      list.forEach((element) => {
        delete element.password;
      });
      return list;
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
  async readUserByEmail(email: string) {
    try {
      let json = {};
      json = {
        email: email,
      };
      let list = await this.db.collection(this.schema).find(json).toArray();
      list.forEach((element) => {
        delete element.password;
      });
      return list;
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
  async getUserPermissionFormEmail(email: string) {
    try {
      let json = {};
      json = {
        email: email,
      };
      let user = await this.db.collection(this.schema).findOne(json, { projection: { permissions: 1, role: 1, _id: 0 } });

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
      let json = {};
      json = {
        email: email,
        disabled: false
      };
      let user = await this.db.collection(this.schema).findOne(json);

      if (user) {
        let res = bcrypt.compareSync(password, user.password);
        return res;

      }

      return false;
    } catch (error) {
      throw error;
    }
  }
  /**
   * Inserts a new user in the database.
   * 
   * @param {any} user - The new user to insert. The password will be hashed before insertion.
   * @returns {Promise<any>} - A promise that resolves to the inserted user object with _id and without password.
   * @throws {Error} - Throws an error if there is an issue querying the database.
   */
  async insertNewUser(user: any) {
    try {
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
  async createSession(email: string) {
    try {
      let newSession = Guid.create().toString();
      const result = await this.db.collection<userModel>(this.schema).updateOne(
        { email: email },
        {
          $push: {
            sessions: {
              $each: [{
                id: newSession,
                update: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              }],
            },
          },
        }
      );
      if (result.upsertedCount > 0) {
        logger.info(`Nuova sessione creata per l'utente ${email} con id ${newSession}`, this.loggerInfo);

        return newSession;
      } else if (result.modifiedCount > 0) {
        logger.info(`Sessione aggiornata per l'utente ${email} con id ${newSession}`, this.loggerInfo);

        return newSession;
      } else {

        throw new Error("Errore durante l'inserimento nel database");
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
  async deleteSession(email: string, sessionId: string) {
    try {
      const result = await this.db.collection<userModel>(this.schema).updateOne(
        { email: email },
        {
          $pull: {
            sessions: { id: sessionId } // Rimuove l'oggetto che ha il campo id uguale a sessionId
          }
        }
      );
      if (result.modifiedCount > 0) {
        // New document inserted, return the new session ID
        return 1;
      } else {
        return 0;
      }
    } catch (error) {
      throw error;
    }
  }
  /**
   * Deletes all sessions for a user in the database.
   * 
   * @param {string} email - The email of the user whose sessions are to be deleted.
   * @param {string} session - The ID of the current session of the user.
   * @returns {Promise<string>} - A promise that resolves to an empty string if all sessions were successfully deleted,
   *                              or throws an error if there was an issue updating the database.
   */
  async deleteAll(email: string, session: string) {
    try {
      const result = await this.db.collection<userModel>(this.schema).updateOne(
        { email: email },
        {
          sessions: [],
        }
      );
      if (result.upsertedCount > 0) {
        // New document inserted, return the new session ID
        return "";
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
    /**
     * Checks the existence and updates the timestamp of a user session in the database.
     * 
     * @param {string} email - The email of the user whose session is to be checked.
     * @param {string} sessionID - The ID of the session to check.
     * @returns {Promise<number>} - A promise that resolves to 0 if the session is not found,
     *                              1 if the session is found and not marked for update,
     *                              or 2 if the session is found and marked for update.
     * @throws {Error} - Throws an error if there is an issue querying the database.
     */
  } async checkSession(email: string, sessionID: string): Promise<number> {
    try {
      // Esegui la query per trovare e aggiornare la sessione
      const result = await this.db.collection(this.schema).findOneAndUpdate(
        {
          email: email,
          "sessions.id": sessionID, // Cerca la sessione per email e sessionID
        }, {
        $set: {
          "sessions.$.updatedAt": new Date().getTime(), // Aggiorna l'updatedAt della sessione
        },
      }

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



}
