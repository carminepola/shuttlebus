import { Db, ClientSession } from "mongodb";
import { Schedule, ScheduleStop, Stop } from "../../model/routesModel";
import booking, { TicketType } from "../../model/bookFromSiteModel";
import { session } from "passport";
import { create } from "domain";
export default class BookingsDAO {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }
  async availableSeats(travelDate: string, routeId: string, scheduleId: string, session?: ClientSession) {
    let q = [
      { $match: { id: routeId } },
      { $unwind: "$schedules" },
      { $match: { "schedules.id": scheduleId } },
      {
        $lookup: {
          from: "bookings",
          let: { routeId: "$id", scheduleId: "$schedules.id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ["$routeId", "$$routeId"] }, { $eq: ["$scheduleId", "$$scheduleId"] }, { $eq: ["$date", travelDate] }, { $in: ["$status", ["pending", "confirmed"]] }],
                },
              },
            },
            {
              $group: {
                _id: null,
                occupiedSeats: { $sum: "$seats" },
                occupiedLuggage: { $sum: "$luggage" },
              },
            },
          ],
          as: "occupiedData",
        },
      },
      {
        $addFields: {
          totalSeats: "$schedules.totalSeats",
          totalLuggage: "$schedules.availableLuggage",
          occupiedSeats: { $ifNull: [{ $arrayElemAt: ["$occupiedData.occupiedSeats", 0] }, 0] },
          occupiedLuggage: { $ifNull: [{ $arrayElemAt: ["$occupiedData.occupiedLuggage", 0] }, 0] },
        },
      },
      {
        $project: {
          _id: 0,

          totalSeats: 1,
          availableSeats: { $subtract: ["$schedules.totalSeats", "$occupiedSeats"] },
          occupiedSeats: 1,

          totalLuggage: "$schedules.availableLuggage",
          occupiedLuggage: 1,
          availableLuggage: { $subtract: ["$schedules.availableLuggage", "$occupiedLuggage"] },
        },
      },
    ];
    if (session) {
      return this.db.collection("routes").aggregate(q, { session }).toArray();
    } else {
      return this.db.collection("routes").aggregate(q).toArray();
    }
  }

  async findAvailableRoutes(travelDate: string, fromStopId: string, toStopId: string, posti: number = 1, bagagli: number = 0) {
    let daysOfWeek = new Date(travelDate).getDay();

    let q = [
      // 2️⃣ Trova solo le `routes` che contengono entrambe le fermate
      {
        $match: {
          "stops.id": { $all: [fromStopId, toStopId] },
        },
      },
      // 3️⃣ Estrai le `schedules` dalla route
      { $unwind: "$schedules" },
      // 4️⃣ Filtra solo le `schedules` attive e valide per il giorno richiesto
      {
        $match: {
          "schedules.status": "active",
          "schedules.stops.id": { $all: [fromStopId, toStopId] },
          $and: [
            { "schedules.stops": { $elemMatch: { id: fromStopId, status: "active" } } }, // Fermata di partenza attiva
            { "schedules.stops": { $elemMatch: { id: toStopId, status: "active" } } }, // Fermata di arrivo attiva
          ],
          $or: [
            {
              // Caso in cui la travelDate è presente in extraDates
              "schedules.extraDates": { $elemMatch: { $eq: travelDate } },
            },

            {
              // Caso in cui la travelDate rientra nel range startDate - endDate
              $and: [
                {
                  "schedules.daysOfWeek": {
                    $not: {
                      $elemMatch: { $eq: daysOfWeek },
                    },
                  },
                },
                {
                  // Caso in cui la travelDate non è esclusa dalle excludedDates

                  "schedules.excludedDates": { $nin: [travelDate] },
                },

                {
                  "schedules.startDate": { $lte: travelDate },
                  "schedules.endDate": { $gte: travelDate },
                },
              ],
            },
          ],
        },
      },
      // 5️⃣ Aggiungi un campo per determinare l'ordine delle fermate
      {
        $addFields: {
          fromStopIndex: { $indexOfArray: ["$schedules.stops.id", fromStopId] },
          toStopIndex: { $indexOfArray: ["$schedules.stops.id", toStopId] },
        },
      },
      // 6️⃣ Filtra solo le `schedules` in cui la fermata di partenza viene prima della fermata di arrivo
      {
        $match: {
          $expr: { $lt: ["$fromStopIndex", "$toStopIndex"] },
        },
      },
      // 7️⃣ Cerca nelle `bookings` per calcolare i posti e bagagli occupati
      {
        $lookup: {
          from: "bookings",
          let: {
            scheduleId: "$schedules.id",
            travelDate: "2025-03-10",
            stops: "$stops",
            fromStopIndex: "$fromStopIndex",
            toStopIndex: "$toStopIndex",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: ["$scheduleId", "$$scheduleId"],
                    },
                    {
                      $eq: ["$date", "$$travelDate"],
                    },
                    {
                      $in: ["$status", ["confirmed", "pending"]],
                    },
                    {
                      $or: [
                        {
                          $gt: [
                            {
                              $indexOfArray: ["$$stops.id", "$to.id"],
                            },
                            "$$fromStopIndex",
                          ],
                        },
                        {
                          $and: [
                            {
                              $gte: [
                                {
                                  $indexOfArray: ["$$stops.id", "$from.id"],
                                },
                                "$$fromStopIndex",
                              ],
                            },
                            {
                              $lt: [
                                {
                                  $indexOfArray: ["$$stops.id", "$from.id"],
                                },
                                "$$toStopIndex",
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },

            {
              $addFields: {
                fromStopPosition: {
                  $indexOfArray: ["$$stops.id", "$from.id"],
                },
                toStopPosition: {
                  $indexOfArray: ["$$stops.id", "$to.id"],
                },
              },
            },
            {
              $match: {
                $expr: {
                  $or: [
                    {
                      $and: [{ $gte: ["$fromStopPosition", "$fromStopIndex"] }, { $lt: ["$fromStopPosition", "$toStopIndex"] }],
                    },
                    {
                      $gt: ["$toStopPosition", "$fromStopIndex"],
                    },
                  ],
                },
              },
            },
            {
              $group: {
                _id: "$scheduleId",
                bookedSeats: { $sum: "$seats" },
                bookedLuggage: { $sum: "$luggage" },
              },
            },
          ],
          as: "bookingsData",
        },
      },

      // 8️⃣ Aggiungi campi con i posti disponibili
      {
        $addFields: {
          bookedSeats: { $ifNull: [{ $arrayElemAt: ["$bookingsData.bookedSeats", 0] }, 0] },
          bookedLuggage: { $ifNull: [{ $arrayElemAt: ["$bookingsData.bookedLuggage", 0] }, 0] },
          totalSeats: "$schedules.totalSeats",
          totalLuggage: "$schedules.availableLuggage",
          availableSeats: {
            $max: [{ $subtract: ["$schedules.totalSeats", { $ifNull: [{ $arrayElemAt: ["$bookingsData.bookedSeats", 0] }, 0] }] }, 0],
          },
          availableLuggage: {
            $max: [{ $subtract: ["$schedules.availableLuggage", { $ifNull: [{ $arrayElemAt: ["$bookingsData.bookedLuggage", 0] }, 0] }] }, 0],
          },
        },
      },
      // 9️⃣ Filtra solo le `schedules` con abbastanza posti e bagagli disponibili
      {
        $match: {
          availableSeats: { $gte: posti },
          availableLuggage: { $gte: bagagli },
        },
      },
      // 🔟 Proietta solo i campi necessari per l'output
      {
        $project: {
          _id: 0,
          dayOfWeekTravelDate: "$dayOfWeekTravelDate",
          scheduleId: "$schedules.id",
          fromStopId: fromStopId,
          toStopId: toStopId,
          routeId: "$id",
          availableSeats: 1,
          availableLuggage: 1,
        },
      },
    ];

    return this.db.collection("routes").aggregate(q).toArray();
  }
  async insertBooking(booking: booking, session?: ClientSession) {
    return this.db.collection("bookings").insertOne(booking, { session });
  }

  async readBookingConfirmed(date: string, routeId: string, scheduleId: string) {
    let search: any = {
      status: "confirmed",
      date,
    };

    if (routeId) {
      search.routeId = routeId;
    }
    if (scheduleId) {
      search.scheduleId = scheduleId;
    }
    const bookings = await this.db.collection("bookings").find(search).toArray();
    if (bookings.length > 0) {
      return bookings;
    } else {
      return null;
    }
  }

  async removeExpiredPendingBookings() {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    return this.db.collection("bookings").updateMany(
      {
        createdAt: { $lt: fifteenMinutesAgo },
        status: "pending",
      },
      {
        $set: {
          status: "expired",
        },
      }
    );
  }

  async cancelBooking(bookingId: string) {
    return this.db.collection("bookings").updateOne(
      {
        ticketId: bookingId,
        status: "pending",
      },
      {
        $set: {
          status: "cancelled",
        },
      }
    );
  }

  async confirmBooking(bookingId: string) {
    return this.db.collection("bookings").updateOne(
      {
        ticketId: bookingId,
        status: "pending",
      },
      {
        $set: {
          status: "confirmed",
        },
      }
    );
  }

  async refundBooking(bookingId: string) {
    return this.db.collection("bookings").updateOne(
      {
        ticketId: bookingId,
        status: "cancelled",
      },
      {
        $set: {
          status: "pending",
        },
      }
    );
  }

  async getBookingForUser(userId: string) {
    return this.db
      .collection("bookings")
      .find({
        userId,
        status: {
          $in: ["pending", "confirmed", "cancelled", "refunded"],
        },
      })
      .project({ date: 1, createdAt: 1, numberOfTickets: 1, status: 1, from: 1, to: 1, travelDate: 1, total: 1, luggage: 1, seats: 1, name: 1, ticketType: 1 })
      .sort({ createdAt: -1 })
      .toArray();
  }
}
