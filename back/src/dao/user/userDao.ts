import { Db, ObjectId } from "mongodb";
import { logger } from "../..";
import bcrypt from "bcrypt";
import { Guid } from "guid-typescript";
import { createObjectCsvStringifier } from "csv-writer";
export interface UsersModel {
  username: string;
  password: string;
  sessions: string[];
}

export default class UsersDao {
  db: Db;
  schema: string = "users";

  constructor(db: Db) {
    this.db = db;
  }

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
  async readUserByUsername(username: string) {
    try {
      let json = {};
      json = {
        username: username,
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
  async checkPassword(username: string, password: string): Promise<boolean> {
    try {
      let json = {};
      json = {
        username: username,
      };
      let list = await this.db.collection(this.schema).find(json).toArray();

      if (list.length > 0) {
        let res = bcrypt.compareSync(password, list[0].password);
        return res;
      }

      return false;
    } catch (error) {
      throw error;
    }
  }
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
  async updatePassword(user: any) {
    try {
      user.password = bcrypt.hashSync(user.password, 10);
      const result = await this.db.collection(this.schema).findOneAndUpdate({ username: user.username }, { $set: { password: user.password } });
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
  // sessione utente
  async createSession(username: string) {
    try {
      let newSession = Guid.create().toString();
      const result = await this.db.collection<UsersModel>(this.schema).updateOne(
        { username: username },
        {
          $push: {
            sessions: {
              $each: [newSession],
            },
          },
        }
      );
      if (result.upsertedCount > 0) {
        // New document inserted, return the new session ID
        return newSession;
      } else if (result.modifiedCount > 0) {
        // Existing document updated, session ID already returned in newSession
        return newSession;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }
  async deleteSession(username: string, session: string) {
    try {
      const result = await this.db.collection<UsersModel>(this.schema).updateOne(
        { username: username },
        {
          $pull: {
            sessions: {
              $in: [session],
            },
          },
        }
      );
      if (result.modifiedCount > 0) {
        // New document inserted, return the new session ID
        return "";
      } else {
        throw new Error("Errore durante la cancellazione dal database");
      }
    } catch (error) {
      throw error;
    }
  }
  async deleteAll(username: string, session: string) {
    try {
      const result = await this.db.collection<UsersModel>(this.schema).updateOne(
        { username: username },
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
  }
  async checkSession(username: string, sessionID: string) {
    try {
      const result = await this.db.collection<UsersModel>(this.schema).countDocuments({
        username: username,
        sessions: { $in: [sessionID] },
      });

      return result > 0; // Restituisce true se la sessione è presente, altrimenti false
    } catch (error) {
      throw error;
    }
  }
}
