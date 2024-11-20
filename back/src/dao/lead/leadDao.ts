import { Db, ObjectId } from "mongodb";
import { logger } from "../..";
import bcrypt from "bcrypt";

export interface leadsDocument {}

export default class leadsDao {
  db: Db;
  schema: string = "leads";

  constructor(db: Db) {
    this.db = db;
  }

  async readAllLeads() {
    try {
      let json = {};
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - 3);
      monthsAgo.setHours(0, 0, 0, 0);

      let list = await this.db
        .collection(this.schema)
        .aggregate([
          {
            $match: {
              date: {
                $gte: Math.floor(monthsAgo.getTime() / 1000), // Timestamp Unix di tre mesi fa
                $lt: Math.floor(Date.now() / 1000), // Timestamp Unix di adesso
              },
            },
          },
          {
            $addFields: {
              formattedDate: {
                $dateToString: {
                  format: "%d/%m/%Y %H:%M:%S",
                  date: { $toDate: { $multiply: ["$date", 1000] } },
                },
              },
            },
          },
          {
            $project: {
              id: 1,
              name: 1,
              ip: 1,
              number: 1,
              userAgent: 1,
              date: "$formattedDate",
            },
          },
          {
            $sort: {
              date: -1, // Ordina dal più nuovo al più vecchio
            },
          },
        ])
        .toArray();
      return list;
    } catch (error) {
      throw error;
    }
  }

  async exsistLead(lead: any) {
    try {
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - 3);
      monthsAgo.setHours(0, 0, 0, 0);
      let find = {
        number: lead.number,
        date: {
          $gte: Math.floor(monthsAgo.getTime() / 1000), // Timestamp Unix di tre mesi fa
          $lt: Math.floor(Date.now() / 1000), // Timestamp Unix di adesso
        },
      };
      const result = await this.db.collection(this.schema).findOne(find);
      if (result) {
        return true;
      }
      return false;
    } catch (error) {
      throw error;
    }
  }

  async insertLead(lead: any) {
    try {
      let result = undefined;

      result = await this.db.collection(this.schema).insertOne({ ...lead });

      if (result) {
        return true;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }
}
