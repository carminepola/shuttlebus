
import { Db, ObjectId } from "mongodb";
import { Guid } from "guid-typescript";
import { logger } from "../..";
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
      const result = await this.db.collection(this.schema).insertOne(stopData);
      return result.insertedId;
    } catch (error) {
      logger.error("Error creating stop:", error);
      throw error;
    }
  }

  async getAllStops() {
    try {
      return await this.db.collection(this.schema).find().toArray();
    } catch (error) {
      logger.error("Error retrieving all stops:", error);
      throw error;
    }
  }

  async updateStop(updateData: Partial<StopModel>) {
    try {
      return await this.db.collection(this.schema).updateOne(
        { id: updateData.id },
        { $set: updateData }
      );
    } catch (error) {
      logger.error("Error updating stop:", error);
      throw error;
    }
  }

  async deleteStop(id: string) {
    try {
      return await this.db.collection(this.schema).deleteOne({ _id: new ObjectId(id) });
    } catch (error) {
      logger.error("Error deleting stop:", error);
      throw error;
    }
  }
}
