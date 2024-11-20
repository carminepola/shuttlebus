import { Db, ObjectId } from "mongodb";
import { logger } from "../..";
import bcrypt from "bcrypt";

export default class FailToBanDao {
  db: Db;
  schema: string = "failToBan";

  constructor(db: Db) {
    this.db = db;
  }

  async isFail(ip: string) {
    try {
      let ris = await this.db.collection(this.schema).find({ ip: ip }).toArray();

      return ris.length > 10 || false;
    } catch (error) {
      throw error;
    }
  }

  async deleteIp(ip: string) {
    try {
      let result = undefined;

      result = await this.db.collection(this.schema).deleteOne({ ip: ip });

      if (result) {
        return true;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }
  async insertIp(ip: string) {
    try {
      let result = undefined;

      result = await this.db.collection(this.schema).insertOne({ ip: ip });

      if (result) {
        return true;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }
}
