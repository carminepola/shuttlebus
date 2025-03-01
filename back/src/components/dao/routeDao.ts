import { Db, ClientSession } from "mongodb";
import { Route, Stop } from "../../model/routeModel";

export class RouteDAO {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** 📌 1. Creare una nuova Route con fermate, biglietti e corse */
  async createRoute(route: Route) {
    return this.db.collection("routes").insertOne(route);
  }

  /** 📌 2. Ottenere una Route per ID */
  async getRouteById(routeId: string) {
    return this.db.collection("routes").findOne({ id: routeId });
  }

  /** 📌 3. Aggiungere una fermata a una Route evitando duplicati e ricalcolando le posizioni */
  async addStopToRoute(routeId: string, stop: Stop) {
    const route = await this.getRouteById(routeId);
    if (!route) return null;

    // Aggiungiamo la fermata e ricalcoliamo le posizioni
    const updatedStops = [...route.stops, stop].sort((a, b) => a.position - b.position).map((s, index) => ({ ...s, position: index }));

    return this.db.collection("routes").updateOne({ id: routeId }, { $set: { stops: updatedStops } });
  }

  /** 📌 4. Disabilitare una fermata senza eliminarla */
  async disableStop(routeId: string, stopId: string) {
    return this.db.collection("routes").updateOne({ id: routeId, "stops.id": stopId }, { $set: { "stops.$.status": "disabled" } });
  }

  /** 📌 5. Abilitare una fermata precedentemente disabilitata */
  async enableStop(routeId: string, stopId: string) {
    return this.db.collection("routes").updateOne({ id: routeId, "stops.id": stopId }, { $set: { "stops.$.status": "active" } });
  }
  /** 📌 6. Ottenere le tratte disponibili con almeno n posti e x bagaglio */
  async findAvailableRoutes(travelDate: string, fromStopId: string, toStopId: string, posti: number = 1, bagagli: number = 0) {
    return this.db
      .collection("routes")
      .aggregate([
        {
          $match: {
            "stops.id": { $all: [fromStopId, toStopId] },
          },
        },
        { $unwind: "$schedules" },
        {
          $match: {
            "schedules.status": "active",
            "schedules.stops.id": { $all: [fromStopId, toStopId] },
            "schedules.excludedDates": { $not: { $elemMatch: { $eq: travelDate } } },
          },
        },
        {
          $lookup: {
            from: "routes",
            let: { scheduleId: "$schedules.id", travelDate: travelDate },
            pipeline: [
              { $unwind: "$bookings" },
              {
                $match: {
                  $expr: {
                    $and: [{ $eq: ["$bookings.scheduleId", "$$scheduleId"] }, { $eq: ["$bookings.travelDate", "$$travelDate"] }, { $in: ["$bookings.status", ["confirmed", "pending"]] }],
                  },
                },
              },
              { $unwind: "$bookings.purchasedTickets" },
              {
                $group: {
                  _id: "$bookings.scheduleId",
                  bookedSeats: { $sum: "$bookings.purchasedTickets.quantity" },
                  bookedLuggage: { $sum: { $ifNull: ["$bookings.luggageBooked", 0] } },
                },
              },
            ],
            as: "bookingsData",
          },
        },
        {
          $addFields: {
            bookedSeats: { $ifNull: [{ $arrayElemAt: ["$bookingsData.bookedSeats", 0] }, 0] },
            bookedLuggage: { $ifNull: [{ $arrayElemAt: ["$bookingsData.bookedLuggage", 0] }, 0] },
            totalSeats: { $ifNull: ["$schedules.totalSeats", 0] },
            totalLuggage: { $ifNull: ["$schedules.availableLuggage", 0] },
            availableSeats: {
              $max: [{ $subtract: ["$schedules.totalSeats", { $ifNull: [{ $arrayElemAt: ["$bookingsData.bookedSeats", 0] }, 0] }] }, 0],
            },
            availableLuggage: {
              $max: [{ $subtract: ["$schedules.availableLuggage", { $ifNull: [{ $arrayElemAt: ["$bookingsData.bookedLuggage", 0] }, 0] }] }, 0],
            },
          },
        },
        {
          $match: {
            availableSeats: { $gte: posti }, // Almeno 2 posti disponibili
            availableLuggage: { $gte: bagagli }, // Almeno 1 bagaglio disponibile
          },
        },
        {
          $project: {
            _id: 0,
            scheduleId: "$schedules.id",
            routeName: "$name",
            totalSeats: 1,
            availableSeats: 1,
            totalLuggage: 1,
            availableLuggage: 1,
          },
        },
      ])
      .toArray();
  }
}
