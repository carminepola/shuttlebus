import { Db } from "mongodb";
import { logger } from "../..";
import { BookingSettings } from "../../utils/bookingSettings";

export default class BookingSettingsDao {
  db: Db;
  schema: string = "bookingSettings";

  constructor(db: Db) {
    this.db = db;
  }

  async get() {
    try {
      return await this.db.collection(this.schema).findOne({ id: "default" }, { projection: { _id: 0 } });
    } catch (error) {
      logger.error("Error retrieving booking settings:", error);
      throw error;
    }
  }

  async update(settings: BookingSettings) {
    try {
      const result = await this.db.collection(this.schema).updateOne({ id: "default" }, { $set: { ...settings, updatedAt: Date.now() } }, { upsert: true });
      return result.acknowledged;
    } catch (error) {
      logger.error("Error updating booking settings:", error);
      throw error;
    }
  }
}
