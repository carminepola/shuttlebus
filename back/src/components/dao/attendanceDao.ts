import { Db } from "mongodb";
import { logger } from "../..";
import attendanceModel from "../../model/attendanceModel";

export default class AttendanceDao {
  db: Db;
  schema: string = "attendances";

  constructor(db: Db) {
    this.db = db;
  }

  async getByMonth(year: number, month: number) {
    try {
      return await this.db
        .collection(this.schema)
        .find({ year, month })
        .sort({ name: 1 })
        .toArray();
    } catch (error) {
      logger.error("Error retrieving attendances:", error);
      throw error;
    }
  }

  async create(obj: attendanceModel) {
    try {
      const result = await this.db.collection(this.schema).insertOne(obj);
      return result.insertedId;
    } catch (error) {
      logger.error("Error creating attendance:", error);
      throw error;
    }
  }

  async update(obj: attendanceModel) {
    try {
      const result = await this.db
        .collection(this.schema)
        .updateOne(
          { id: obj.id },
          { $set: { name: obj.name, days: obj.days || {}, updatedAt: new Date().getTime() } },
        );
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error("Error updating attendance:", error);
      throw error;
    }
  }

  async delete(id: string) {
    try {
      const result = await this.db.collection(this.schema).deleteOne({ id });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error("Error deleting attendance:", error);
      throw error;
    }
  }
}
