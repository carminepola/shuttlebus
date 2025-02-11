import { Db, ObjectId } from "mongodb";
import { Guid } from "guid-typescript";
import { logger } from "../../..";
import StopModel from "../../model/stopsModel";

export default class StopsDao {
  db: Db;
  schema: string = "stops";
  logInfo: any;

  constructor(db: Db, logInfo?: any) {
    this.db = db;
    this.logInfo = logInfo;
  }

  async createStop(stopData: Partial<StopModel>) {
    try {
      const existingStop = await this.db.collection(this.schema).findOne({ id: stopData.id });
      if (existingStop) {
        throw new Error("Stop with the same ID already exists");
      }
      const result = await this.db.collection(this.schema).insertOne(stopData);
      return result.insertedId ? stopData.id : null;
    } catch (error) {
      logger.error("Error creating stop:", error);
      throw error;
    }
  }

  async getAllStops() {
    try {
      return await this.db.collection(this.schema).find({ isDeleted: false }).toArray();
    } catch (error) {
      logger.error("Error retrieving all stops:", error);
      throw error;
    }
  }

  async getAllActiveStops() {
    try {
      return await this.db.collection(this.schema).find({ isActive: true, isDeleted: false }).toArray();
    } catch (error) {
      logger.error("Error retrieving all stops:", error);
      throw error;
    }
  }
  async getStops(id: string) {
    try {
      return await this.db.collection(this.schema).findOne({ id: id, isDeleted: false });
    } catch (error) {
      logger.error("Error retrieving all stops:", error);
      throw error;
    }
  }
  async updateStop(updateData: Partial<StopModel>) {
    try {
      return await this.db.collection(this.schema).updateOne({ id: updateData.id, isDeleted: false }, { $set: updateData });
    } catch (error) {
      logger.error("Error updating stop:", error);
      throw error;
    }
  }

  async deleteStop(id: string) {
    try {
      return await this.db.collection(this.schema).updateOne({ id: id }, { $set: { isDeleted: true } });
    } catch (error) {
      logger.error("Error deleting stop:", error);
      throw error;
    }
  }
}
