import { Db } from "mongodb";

export default class FailToBanDao {
  db: Db;
  schema: string = "failToBan";

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Check if the given ip is banned (more than 10 attempts)
   * @param ip the ip to check
   * @returns true if the ip is banned, false otherwise
   * @throws Error if there was an error during the operation
   */
  async isFail(ip: string) {
    try {
      let ris = await this.db.collection(this.schema).find({ ip: ip }).toArray();

      return ris.length >= 10;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all documents with the given ip
   * @param ip the ip to delete
   * @returns true if the operation was successful, false otherwise
   * @throws Error if there was an error during the operation
   */
  async deleteIp(ip: string) {
    try {
      let result = undefined;

      result = await this.db.collection(this.schema).deleteMany({ ip: ip });

      if (result) {
        return true;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }
  /**
   * Insert a document with the given ip into the collection
   * @param ip the ip to insert
   * @returns true if the operation was successful, false otherwise
   * @throws Error if there was an error during the operation
   */
  async insertIp(ip: string) {
    try {
      let result = await this.db.collection(this.schema).insertOne({ ip: ip, date: new Date() });

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
