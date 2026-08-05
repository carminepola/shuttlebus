import { Db, ObjectId } from "mongodb";
import { Guid } from "guid-typescript";
import { logger } from "../..";
import lngModel from "../../model/lngModel";

export default class lngDao {
  db: Db;
  schema: string = "lng";
  logInfo: any;
  private static indexEnsured = false;

  constructor(db: Db, logInfo?: any) {
    this.db = db;
    this.logInfo = logInfo;
  }

  async ensureIndexes() {
    if (lngDao.indexEnsured) return;
    try {
      await this.db.collection(this.schema).createIndex({ txt: 1 }, { unique: true, name: "uniq_txt" });
      lngDao.indexEnsured = true;
      logger.info("Indice unico su 'lng.txt' assicurato");
    } catch (error: any) {
      if (error?.code === 11000) {
        logger.warn("Indice unico su 'lng.txt' NON creato: esistono chiavi 'txt' duplicate. Eseguire lo script di cleanup (back/src/scripts/cleanup-lng.ts).");
      } else {
        logger.error("Errore creazione indice lng:", error);
      }
    }
  }

  async create(obj: lngModel) {
    try {
      const existingLng = await this.db.collection(this.schema).findOne({ id: obj.id });
      if (existingLng) {
        throw new Error("existingLng with the same ID already exists");
      }
      const result = await this.db.collection(this.schema).insertOne(obj);
      return result.insertedId ? obj.id : null;
    } catch (error) {
      logger.error("Error creating ticketType:", error);
      throw error;
    }
  }

  async update(obj: lngModel) {
    try {
      const result = await this.db.collection(this.schema).updateOne({ id: obj.id }, { $set: {
        it: obj.it,
        en: obj.en,
        fr: obj.fr,
        de: obj.de,
        es: obj.es,
        jp: obj.jp,
      } });
  
      return result.matchedCount > 0 || result.modifiedCount > 0 ? obj.id : null;
    } catch (error) {
      logger.error("Error creating ticketType:", error);
      throw error;
    }
  }
  async getAll() {
    try {
      await this.ensureIndexes();
      return await this.db.collection(this.schema).find().sort({ txt: 1 }).toArray();
    } catch (error) {
      logger.error("Error retrieving all lng:", error);
      throw error;
    }
  }
  async delete(id: string) {
    try {
      return await this.db.collection(this.schema).deleteOne({ id: id });
    } catch (error) {
      logger.error("Error delete  lng:", error);
      throw error;
    }
  }
}
