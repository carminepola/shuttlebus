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
        .aggregate([
          {
            $match: { day: new Date().toISOString().split("T")[0] },
          },
          {
            $lookup: {
              from: "licensePlates",
              localField: "busId",
              foreignField: "licensePlate",
              as: "licensePlateInfo",
            },
          },
          {
            $unwind: {
              path: "$licensePlateInfo",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $addFields: {
              imei: "$licensePlateInfo.imei",
            },
          },
          {
            $project: {
              licensePlateInfo: 0,
            },
          },
        ])
        .toArray();
    } catch (error) {
      logger.error("Error retrieving all ticketType:", error);
      throw error;
    }
  }
  async getCurrent() {
    try {
      return await this.db
        .collection(this.schema)
        .find({ date: new Date().toISOString().split("T")[0] })
        .project({ busId: 1, currentLat: "$lat", currentLng: "$lng", currentAngle: "$angle" })
        .toArray();
    } catch (error) {
      logger.error("Error retrieving all ticketType:", error);
      throw error;
    }
  }
  async update(obj: any) {
    try {
      let toInsert: any;

      const alredyExist = await this.db.collection(this.schema).findOne({ date: new Date().toISOString().split("T")[0], imei: obj.imei });
      if (!alredyExist || alredyExist.positions.length == 0) {
        toInsert = JSON.parse(JSON.stringify(obj));
        toInsert.positions = [JSON.parse(JSON.stringify(obj))];
      } else {
        if (alredyExist.positions.find((t: any) => (t.updatedFromMomap = obj.updatedFromMomap))) return true;

        toInsert = JSON.parse(JSON.stringify(obj));
        toInsert.positions = alredyExist.positions;
        toInsert.positions.push(obj);
      }
      if (!alredyExist) {
        await this.db.collection(this.schema).insertOne(toInsert);
        return true;
      } else {
        const result = await this.db.collection(this.schema).updateOne({ day: obj.day, imei: obj.imei }, { $set: toInsert }, { upsert: true });
        return result.modifiedCount > 0;
      }
    } catch (error) {
      logger.error("Error creating ticketType:", error);
      throw error;
    }
  }
}
