import { Db, ObjectId } from "mongodb";
import { Guid } from "guid-typescript";
import { logger } from "../..";
import TicketTypeModel from "../../model/ticketTypeModel";

export default class TicketTypeDao {
  db: Db;
  schema: string = "ticketType";
  logInfo: any;

  constructor(db: Db, logInfo?: any) {
    this.db = db;
    this.logInfo = logInfo;
  }

  async createTicketType(ticketTypeData: TicketTypeModel) {
    try {
      const existingTicketType = await this.db.collection(this.schema).findOne({ id: ticketTypeData.id });
      if (existingTicketType) {
        throw new Error("TicketType with the same ID already exists");
      }
      const result = await this.db.collection(this.schema).insertOne(ticketTypeData);
      return result.insertedId ? ticketTypeData.id : null;
    } catch (error) {
      logger.error("Error creating ticketType:", error);
      throw error;
    }
  }

  async getAllTicketType() {
    try {
      return await this.db.collection(this.schema).find({ isDeleted: false }).toArray();
    } catch (error) {
      logger.error("Error retrieving all ticketType:", error);
      throw error;
    }
  }
  async getAllActiveTicketType() {
    try {
      return await this.db.collection(this.schema).find({ isDeleted: false, isActive: true }).project({ id: 1, name: 1, description: 1, cost: 1, _id: 0 }).toArray();
    } catch (error) {
      logger.error("Error retrieving all ticketType:", error);
      throw error;
    }
  }
  async getTicketType(id: string) {
    try {
      return await this.db.collection(this.schema).findOne({ id: id, isDeleted: false });
    } catch (error) {
      logger.error("Error retrieving all ticketType:", error);
      throw error;
    }
  }

  async updateTicketType(updateData: TicketTypeModel) {
    try {
      return await this.db.collection(this.schema).updateOne({ id: updateData.id, isDeleted: false }, { $set: updateData });
    } catch (error) {
      logger.error("Error updating ticketType:", error);
      throw error;
    }
  }

  async deleteTicketType(id: string) {
    try {
      return await this.db.collection(this.schema).updateOne({ id: id }, { $set: { isDeleted: true } });
    } catch (error) {
      logger.error("Error deleting ticketType:", error);
      throw error;
    }
  }
}
