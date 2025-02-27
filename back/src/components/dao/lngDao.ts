import { Db, ObjectId } from "mongodb";
import { Guid } from "guid-typescript";
import { logger } from "../..";
import lngModel from "../../model/lngModel";

export default class lngDao {
  db: Db;
  schema: string = "lng";
  logInfo: any;

  constructor(db: Db, logInfo?: any) {
    this.db = db;
    this.logInfo = logInfo;
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

  async update(obj:lngModel){
    try {
      const result = await this.db.collection(this.schema).updateOne({ id: obj.id }, { $set: {
        it: obj.it,
        en: obj.en
      } });
 
      return result.upsertedId  ? obj.id : null;
    } catch (error) {
      logger.error("Error creating ticketType:", error);
      throw error;
    }
  }
  async getAll() {
    try {
      return await this.db.collection(this.schema).find().toArray();
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
