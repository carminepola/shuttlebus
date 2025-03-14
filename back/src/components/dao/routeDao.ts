import { Db, ClientSession } from "mongodb";
import { Route, Stop } from "../../model/routesModel";
import { Schedule } from "../../model/routesModel";
export class RouteDAO {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async insertRoute(route: Partial<Route>) {
    try {
      const result = await this.db.collection("routes").insertOne(route);
      return result.insertedId;
    } catch (error) {
      throw error;
    }
  }
  async updateRoute(nameIt: string, nameEn: string, stops: Stop[], ticketTypes: string[], routeId: string, enabled: boolean) {
    try {
      const result = await this.db.collection("routes").updateOne(
        { id: routeId },
        {
          $set: {
            "name.it": nameIt,
            "name.en": nameEn,
            stops: stops,
            enabled: enabled,
            ticketTypes: ticketTypes,
          },
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      throw error;
    }
  }

  async getRoutes() {
    try {
      const routes = await this.db.collection("routes").find().toArray();
      return routes;
    } catch (error) {
      throw error;
    }
  }
  async getRouteById(id: string) {
    try {
      const route = await this.db.collection("routes").findOne({ id: id });
      return route;
    } catch (error) {
      throw error;
    }
  }
  async deleteRoute(id: string) {
    try {
      const result = await this.db.collection("routes").deleteOne({ id: id });
      return result.deletedCount > 0;
    } catch (error) {
      throw error;
    }
  }
  async getEnabledRoutes() {
    try {
      const routes = await this.db.collection("routes").find({ enabled: true }).toArray();
      return routes;
    } catch (error) {
      throw error;
    }
  }

  // Da qui cominciano gli schedules

  async insertSchedule(schedule: Partial<Schedule>, routeId: string) {
    try {
      const result = await this.db.collection("routes").updateOne({ id: routeId }, { $addToSet: { schedules: schedule } });
      return result.upsertedCount > 0;
    } catch (error) {
      throw error;
    }
  }
  async updateSchedule(scheduleId: string, schedule: Partial<Schedule>, routeId: string) {
    try {
      const result = await this.db.collection("routes").updateOne(
        {
          id: routeId, // Cerca il documento della route
          "schedules.id": scheduleId, // Assicurati che il documento abbia il schedule da aggiornare
        },
        {
          $set: Object.fromEntries(Object.entries(schedule).map(([key, value]) => [`schedules.$[elem].${key}`, value])),
        },
        {
          arrayFilters: [{ "elem.id": scheduleId }], // Seleziona l'elemento corretto nell'array
        }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error("Error updating schedule:", error);
      throw error;
    }
  }

  async routesToDay() {
    let todayDate = new Date().toISOString().split("T")[0]; // Formato YYYY-MM-DD
    let todayDayOfWeek = (new Date().getDay() + 6) % 7; // Converti: Lunedì = 0, Domenica = 6

    return this.db
      .collection("routes")
      .aggregate([
        // 1️⃣ Espandi le `schedules`
        { $unwind: "$schedules" },

        // 2️⃣ Filtra solo le `schedules` attive e valide per oggi
        {
          $match: {
            "schedules.status": "active",

            // Se la data di oggi è tra `startDate` e `endDate`
            "schedules.startDate": { $lte: todayDate },
            "schedules.endDate": { $gte: todayDate },

            $or: [
              {
                // Caso in cui oggi è una extraDate
                "schedules.extraDates": { $elemMatch: { $eq: todayDate } },
              },
              {
                $and: [
                  {
                    "schedules.daysOfWeek": {
                      $not: {
                        $elemMatch: { $eq: todayDayOfWeek },
                      },
                    },
                  },
                  {
                    // Caso in cui la travelDate non è esclusa dalle excludedDates

                    "schedules.excludedDates": { $nin: [todayDate] },
                  },

                  {
                    "schedules.startDate": { $lte: todayDate },
                    "schedules.endDate": { $gte: todayDate },
                  },
                ],
              },
            ],
          },
        },

        // 3️⃣ Conta il numero di corse attive oggi
        { $count: "active_schedules_today" },
      ])
      .toArray();
  }
}
