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
        .project({ busId: 1, plate: 1, name: 1, currentLat: "$lat", currentLng: "$lng", currentAngle: "$angle" })
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
        if (alredyExist.positions.find((t: any) => t.updatedFromMomap == obj.updatedFromMomap)) return true;

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

  /**
   * Salva le assegnazioni bus-schedule per un dato giorno
   */
  async saveBusScheduleAssignments(day: string, assignments: any[]) {
    try {
      logger.info(`Salvataggio assegnazioni per giorno ${day}, numero assegnazioni: ${assignments.length}`);

      // Elimina le assegnazioni esistenti per questo giorno
      const deleteResult = await this.db.collection("busScheduleAssignments").deleteMany({ day });
      logger.info(`Eliminate ${deleteResult.deletedCount} assegnazioni esistenti per ${day}`);

      // Inserisci le nuove assegnazioni
      if (assignments.length > 0) {
        const insertResult = await this.db.collection("busScheduleAssignments").insertMany(assignments);
        logger.info(`Inserite ${insertResult.insertedCount} nuove assegnazioni per ${day}`);
      } else {
        logger.warn(`Nessuna assegnazione da salvare per ${day}`);
      }

      return true;
    } catch (error) {
      logger.error("Error saving bus schedule assignments:", error);
      throw error;
    }
  }

  /**
   * Recupera le assegnazioni bus-schedule per un dato giorno
   */
  async getBusScheduleAssignments(day: string) {
    try {
      logger.info(`Recupero assegnazioni per giorno ${day}`);
      const assignments = await this.db.collection("busScheduleAssignments").find({ day }).toArray();
      logger.info(`Recuperate ${assignments.length} assegnazioni per giorno ${day}`);
      return assignments;
    } catch (error) {
      logger.error("Error retrieving bus schedule assignments:", error);
      throw error;
    }
  }

  /**
   * Verifica se esistono assegnazioni per un dato giorno
   */
  async hasBusScheduleAssignments(day: string) {
    try {
      logger.info(`Verifica esistenza assegnazioni per giorno ${day}`);
      const count = await this.db.collection("busScheduleAssignments").countDocuments({ day });
      const hasAssignments = count > 0;
      logger.info(`Assegnazioni esistenti per giorno ${day}: ${hasAssignments} (count: ${count})`);
      return hasAssignments;
    } catch (error) {
      logger.error("Error checking bus schedule assignments:", error);
      throw error;
    }
  }
}
