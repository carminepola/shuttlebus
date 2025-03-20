import { Db, ObjectId } from "mongodb";
import { Guid } from "guid-typescript";
import { logger } from "../..";

export default class MomapDao {
  db: Db;
  schema: string = "momap";

  constructor(db: Db) {
    this.db = db;
  }

  async create(obj: any) {
    try {
      const result = await this.db.collection(this.schema).insertMany(obj);
      return result.insertedCount > 0;
    } catch (error) {
      logger.error("Error creating ticketType:", error);
      throw error;
    }
  }

  async get() {
    try {
      return await this.db
        .collection(this.schema)
        .find({ day: new Date().toISOString().split("T")[0] })
        .toArray();
    } catch (error) {
      logger.error("Error retrieving all ticketType:", error);
      throw error;
    }
  }
  async update(obj: any) {
    try {
      const result = await this.db.collection(this.schema).updateOne({ day: obj.day, busId: obj.busId }, { $set: obj }, { upsert: true });
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error("Error creating ticketType:", error);
      throw error;
    }
  }
}
