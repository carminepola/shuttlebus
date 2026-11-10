import { Db, ClientSession } from "mongodb";
import { Route, Stop, Fare } from "../../model/routesModel";
import { Schedule } from "../../model/routesModel";
import { scheduleRunsOn } from "../../utils/scheduleDates";
import { localDate } from "../../utils/bookingCutoff";
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
  async updateRoute(name: Record<string, string>, stops: Stop[], ticketTypes: string[], routeId: string, enabled: boolean, fares?: Fare[]) {
    try {
      const set: Record<string, any> = {
        name,
        stops: stops,
        enabled: enabled,
        ticketTypes: ticketTypes,
      };
      if (fares !== undefined) set.fares = fares;
      const result = await this.db.collection("routes").updateOne({ id: routeId }, { $set: set });
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

  /**
   * Id delle corse che viaggiano nel giorno indicato (oggi di default), con la
   * stessa regola della ricerca clienti: utils/scheduleDates.scheduleRunsOn.
   */
  async scheduleIdsRunningOn(date: string = localDate()): Promise<string[]> {
    const routes = await this.db.collection("routes").find({}, { projection: { _id: 0, schedules: 1 } }).toArray();
    const ids: string[] = [];
    for (const r of routes) for (const sc of (r as any).schedules || []) if (scheduleRunsOn(sc, date)) ids.push(sc.id);
    return ids;
  }

  async routesToDay() {
    const ids = await this.scheduleIdsRunningOn();
    return this.db
      .collection("routes")
      .aggregate([{ $unwind: "$schedules" }, { $match: { "schedules.id": { $in: ids } } }, { $count: "active_schedules_today" }])
      .toArray();
  }
  async routesToDayList() {
    const ids = await this.scheduleIdsRunningOn();
    return this.db
      .collection("routes")
      .aggregate([{ $unwind: "$schedules" }, { $match: { "schedules.id": { $in: ids } } }])
      .toArray();
  }
  async currentSchedules() {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Orario in minuti
    const ids = await this.scheduleIdsRunningOn();

    const currentSchedule = this.db.collection("routes").aggregate([
      { $unwind: "$schedules" }, // Espande l'array delle schedule
      { $match: { "schedules.id": { $in: ids } } }, // corse che viaggiano oggi
      {
        $addFields: {
          departureMinutes: {
            $add: [{ $multiply: [{ $toInt: { $substr: ["$schedules.departureTime", 0, 2] } }, 60] }, { $toInt: { $substr: ["$schedules.departureTime", 3, 2] } }],
          },
          arrivalMinutes: {
            $add: [{ $multiply: [{ $toInt: { $substr: ["$schedules.arrivalTime", 0, 2] } }, 60] }, { $toInt: { $substr: ["$schedules.arrivalTime", 3, 2] } }],
          },
        },
      },
      {
        $match: {
          departureMinutes: { $lte: currentTime }, // La partenza deve essere avvenuta o imminente
          arrivalMinutes: { $gte: currentTime }, // Il viaggio deve essere ancora in corso
        },
      },
      { $sort: { "schedules.departureTime": 1 } }, // Ordina per partenza più vicina
      // Prende solo la prima schedule valida
    ]);

    return currentSchedule.toArray();
  }
}
