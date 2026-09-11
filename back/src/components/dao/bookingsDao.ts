import { Db, ClientSession } from "mongodb";
import { Schedule, ScheduleStop, Stop } from "../../model/routesModel";
import booking, { TicketType } from "../../model/bookFromSiteModel";
import { session } from "passport";
import { create } from "domain";
import { LUGGAGE_PRICE } from "../../constants";
export default class BookingsDAO {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }
  async currentDayBookingsFromScheduleId(scheduleId: string) {
    let q = {
      scheduleId: scheduleId,
      date: new Date().toISOString().split("T")[0],
      status: "confirmed",
    };
    return this.db.collection("bookings").find(q).toArray();
  }
  async availableSeats(travelDate: string, routeId: string, scheduleId: string, fromStopId: string, toStopId: string, session?: ClientSession) {
    let q = [
      { $match: { id: routeId } },
      { $unwind: "$schedules" },
      { $match: { "schedules.id": scheduleId } },
      {
        $addFields: {
          fromStopIndex: { $indexOfArray: ["$schedules.stops.id", fromStopId] },
          toStopIndex: { $indexOfArray: ["$schedules.stops.id", toStopId] },
        },
      },
      {
        $lookup: {
          from: "bookings",
          let: { routeId: "$id", scheduleId: "$schedules.id", fromStopIndex: "$fromStopIndex", toStopIndex: "$toStopIndex", travelDate: travelDate, stops: "$stops" },

          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$routeId", "$$routeId"] },
                    { $eq: ["$scheduleId", "$$scheduleId"] },
                    {
                      $eq: ["$date", "$$travelDate"],
                    },
                    { $in: ["$status", ["pending", "confirmed"]] },
                    {
                      $or: [
                        {
                          $and: [
                            {
                              $lte: [
                                {
                                  $indexOfArray: ["$$stops.id", "$from.id"],
                                },
                                "$$fromStopIndex",
                              ],
                            },
                            {
                              $gte: [
                                {
                                  $indexOfArray: ["$$stops.id", "$to.id"],
                                },
                                "$$toStopIndex",
                              ],
                            },
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
                        {
                          $and: [
                            {
                              $gte: [
                                {
                                  $indexOfArray: ["$$stops.id", "to.id"],
                                },
                                "$$fromStopIndex",
                              ],
                            },
                            {
                              $lt: [
                                {
                                  $indexOfArray: ["$$stops.id", "to.id"],
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
          enabled: true,
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
            travelDate: travelDate,
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
                      //questo filtra quelle che non coinvolgono la tratta
                      $or: [
                        {
                          $and: [
                            {
                              $lte: [
                                {
                                  $indexOfArray: ["$$stops.id", "$from.id"],
                                },
                                "$$fromStopIndex",
                              ],
                            },
                            {
                              $gte: [
                                {
                                  $indexOfArray: ["$$stops.id", "$to.id"],
                                },
                                "$$toStopIndex",
                              ],
                            },
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
                        {
                          $and: [
                            {
                              $gte: [
                                {
                                  $indexOfArray: ["$$stops.id", "to.id"],
                                },
                                "$$fromStopIndex",
                              ],
                            },
                            {
                              $lt: [
                                {
                                  $indexOfArray: ["$$stops.id", "to.id"],
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
  async getBookingFromNumber(numberOfTickets: string): Promise<booking> {
    return new booking(await this.db.collection("bookings").findOne({ numberOfTickets }));
  }

  async readBookingConfirmed(date: string, routeId: string, scheduleId: string, status: string) {
    let search: any = {
      date,
    };

    if (!status || status === "all") {
      search.status = { $not: { $in: ["deleted", "expired"] } };
    } else {
      search.status = status;
    }

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
    this.db.collection("bookings").updateMany(
      {
        createdAt: { $lt: new Date().getTime() - 30 * 60 * 1000 },
        status: "pending",
      },
      {
        $set: {
          updatedAt: new Date().getTime(),
          status: "expired",
        },
      },
    );
  }

  async expireTicketById(ticketId: string) {
    this.db.collection("bookings").updateMany(
      {
        numberOfTickets: ticketId,
        status: "pending",
      },
      {
        $set: {
          updatedAt: new Date().getTime(),
          status: "expired",
        },
      },
    );
  }

  async cancelBooking(bookingId: string, cancelMotivation?: string) {
    let q: any = {
      numberOfTickets: bookingId,
      status: { $in: ["confirmed"] },
    };

    return this.db
      .collection("bookings")
      .updateOne(q, {
        $set: {
          updatedAt: new Date().getTime(),
          status: "cancelled",
          cancelMotivation,
        },
      })
      .then((result) => {
        if (result.matchedCount > 0) {
          return true;
        } else {
          return false;
        }
      });
  }

  async confirmBooking(bookingId: string, stripeSessionId?: string) {
    let q: any = {
      numberOfTickets: bookingId,
      status: "pending",
    };
    if (stripeSessionId) {
      q["other.id"] = stripeSessionId;
    }
    return this.db
      .collection("bookings")
      .updateOne(q, {
        $set: {
          updatedAt: new Date().getTime(),
          status: "confirmed",
        },
      })
      .then((result) => {
        if (result.matchedCount > 0) {
          return true;
        } else {
          return false;
        }
      });
  }

  async refundBooking(bookingId: string, userId?: string) {
    let q: any = {
      numberOfTickets: bookingId,
      status: { $in: ["confirmed", "cancelled"] },
    };
    if (userId) {
      q.userId = userId;
    }
    return this.db
      .collection("bookings")
      .updateOne(q, {
        $set: {
          updatedAt: new Date().getTime(),
          status: "refunded",
        },
      })
      .then((result) => result.matchedCount > 0);
  }

  async partialRefundBooking(bookingId: string, items: { ticketTypeId: string; count: number }[], refundAmount: number, refundedSeats: number, refundedLuggage: number, userId?: string) {
    let q: any = {
      numberOfTickets: bookingId,
      status: { $in: ["confirmed", "cancelled"] },
    };
    if (userId) {
      q.userId = userId;
    }

    const existing = await this.db.collection("bookings").findOne({ numberOfTickets: bookingId });
    if (!existing) return false;

    const updatedTicketTypes = existing.ticketTypes.map((tt: any) => {
      const refundItem = items.find((i: any) => i.ticketTypeId === tt.id);
      if (refundItem) {
        return { ...tt, count: tt.count - refundItem.count };
      }
      return tt;
    }).filter((tt: any) => tt.count > 0);

    const newTotal = existing.total - refundAmount;
    const newSeats = existing.seats - refundedSeats;
    const newLuggage = existing.luggage - refundedLuggage;

    const allRefunded = updatedTicketTypes.length === 0 && newLuggage === 0;

    return this.db
      .collection("bookings")
      .updateOne(q, {
        $set: {
          updatedAt: new Date().getTime(),
          status: allRefunded ? "refunded" : existing.status,
          ticketTypes: updatedTicketTypes,
          total: newTotal,
          seats: newSeats,
          luggage: newLuggage,
        },
        $inc: {
          refundedAmount: refundAmount,
        },
      })
      .then((result) => result.matchedCount > 0);
  }
  async getBooking(numberOfTickets: string) {
    return this.db.collection("bookings").findOne({ numberOfTickets });
  }

  async scanBooking(numberOfTickets: string, driverId: string, driverName: string) {
    const existing = await this.db.collection("bookings").findOne({ numberOfTickets, status: "confirmed" });
    if (!existing) return null;

    if (existing.scannedBy) {
      return { alreadyScanned: true, scannedBy: existing.scannedBy, booking: existing };
    }

    const scanData = { driverId, driverName, scannedAt: new Date().getTime() };
    const updated = await this.db
      .collection("bookings")
      .findOneAndUpdate({ numberOfTickets, status: "confirmed", scannedBy: { $exists: false } }, { $set: { scannedBy: scanData, updatedAt: new Date().getTime() } }, { returnDocument: "after" });

    if (!updated) {
      const retry = await this.db.collection("bookings").findOne({ numberOfTickets });
      return { alreadyScanned: true, scannedBy: retry?.scannedBy, booking: retry };
    }

    return { alreadyScanned: false, booking: updated };
  }

  readPendingBookingForUser(userId: string) {
    return this.db.collection("bookings").find({ userId, status: "pending" }).toArray();
  }

  async getBookingFromUser(userId: string, includeAllStatus: boolean = false) {
    const query: any = { userId };
    if (!includeAllStatus) {
      query.status = {
        $in: ["pending", "confirmed", "cancelled", "refunded"],
      };
    }
    return this.db
      .collection("bookings")
      .find(query)
      .project({ date: 1, createdAt: 1, numberOfTickets: 1, status: 1, from: 1, to: 1, travelDate: 1, total: 1, luggage: 1, seats: 1, name: 1, ticketTypes: 1, other: 1, routeId: 1 })
      .sort({ createdAt: -1 })
      .toArray();
  }

  /*************  ✨ Codeium Command ⭐  *************/
  /**
   * Update the paymentIntentId for a booking
   * @param numberOfTickets The ID of the booking
   * @param paymentIntentId The ID of the payment intent
   * @returns A promise that resolves if the update was successful

/******  d2a0a905-b603-4fe3-8309-fb15dfbcf992  *******/
  async updatePaymentIntentId(numberOfTickets: string, paymentIntentId: string) {
    return this.db.collection("bookings").updateOne({ numberOfTickets }, { $set: { paymentIntentId: paymentIntentId, updatedAt: new Date().getTime() } });
  }
  async readByPaymentIntentId(paymentIntentId: string) {
    return this.db.collection("bookings").findOne({ paymentIntentId });
  }
  async updatePaymentInfo(type: string, other: any, numberOfTickets: string) {
    return this.db.collection("bookings").updateOne({ numberOfTickets }, { $set: { paymentMethod: type, other: other, updatedAt: new Date().getTime() } });
  }
  async deleteBooking(bookingId: string, userId?: string) {
    let q: any = {
      numberOfTickets: bookingId,
      status: { $in: ["pending"] },
    };
    if (userId) {
      q.userId = userId;
    }
    return this.db
      .collection("bookings")
      .updateOne(q, {
        $set: {
          updatedAt: new Date().getTime(),
          status: "deleted",
        },
      })
      .then((result) => {
        if (result.matchedCount > 0) {
          return true;
        } else {
          return false;
        }
      });
  }
  async ticketToDay() {
    return this.db
      .collection("bookings")
      .aggregate([
        {
          $match: {
            date: new Date().toISOString().split("T")[0],
            status: "confirmed", // Imposta automaticamente la data di oggi in formato YYYY-MM-DD
          },
        },
        {
          $group: {
            _id: null,
            totalTickets: { $sum: 1 }, // Conta il numero totale di biglietti prenotati oggi
          },
        },
      ])
      .toArray();
  }
  async seatsToDay() {
    return this.db
      .collection("bookings")
      .aggregate([
        {
          $match: {
            date: new Date().toISOString().split("T")[0],
            status: "confirmed", // Imposta automaticamente la data di oggi in formato YYYY-MM-DD
          },
        },
        {
          $group: {
            _id: null,
            totalTickets: { $sum: "$seats" }, // Conta il numero totale di biglietti prenotati oggi
          },
        },
      ])
      .toArray();
  }
  async andamento() {
    let today = new Date();

    let startDatePast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    startDatePast.setHours(0, 0, 0, 0);

    let endDatePast = new Date(today.getFullYear(), today.getMonth(), 0);
    endDatePast.setHours(23, 59, 59, 999);

    let startDateCurrent = new Date(today.getFullYear(), today.getMonth(), 1);
    startDateCurrent.setHours(0, 0, 0, 0);

    let endDateCurrent = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endDateCurrent.setHours(23, 59, 59, 999);

    let startDateNext = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    startDateNext.setHours(0, 0, 0, 0);

    let endDateNext = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    endDateNext.setHours(23, 59, 59, 999);

    let startDateYearAgo = new Date(today.getFullYear() - 1, today.getMonth() - 1, 1);
    startDateYearAgo.setHours(0, 0, 0, 0);

    let endDateYearAgo = new Date(today.getFullYear() - 1, today.getMonth() + 2, 0);
    endDateYearAgo.setHours(23, 59, 59, 999);

    let startDateYearAgoCurrent = new Date(today.getFullYear() - 1, today.getMonth(), 1);
    startDateYearAgoCurrent.setHours(0, 0, 0, 0);

    let endDateYearAgoCurrent = new Date(today.getFullYear() - 1, today.getMonth() + 1, 0);
    endDateYearAgoCurrent.setHours(23, 59, 59, 999);

    const formatDate = (date: any) => date.toISOString().split("T")[0];

    const generateDateRange = (start: any, end: any, period: any) => {
      let dates = [];
      let currentDate = new Date(start);
      while (currentDate <= end) {
        dates.push({ date: formatDate(currentDate), totalTickets: 0, period });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return dates;
    };

    let allDates = [
      ...generateDateRange(startDatePast, endDatePast, "past"),
      ...generateDateRange(startDateCurrent, endDateCurrent, "current"),
      ...generateDateRange(startDateNext, endDateNext, "next"),
      ...generateDateRange(startDateYearAgo, endDateYearAgo, "yearAgo"),
    ];

    let bookings = await this.db
      .collection("bookings")
      .aggregate([
        {
          $match: {
            date: {
              $gte: formatDate(startDateYearAgo),
              $lte: formatDate(endDateNext),
            },
            status: { $eq: "confirmed" },
          },
        },
        {
          $addFields: {
            period: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [{ $gte: ["$date", formatDate(startDateCurrent)] }, { $lte: ["$date", formatDate(endDateCurrent)] }],
                    },
                    then: "current",
                  },
                  {
                    case: {
                      $and: [{ $gte: ["$date", formatDate(startDateYearAgo)] }, { $lte: ["$date", formatDate(endDateYearAgo)] }],
                    },
                    then: "yearAgo",
                  },
                  {
                    case: {
                      $and: [{ $gte: ["$date", formatDate(startDatePast)] }, { $lte: ["$date", formatDate(endDatePast)] }],
                    },
                    then: "past",
                  },
                ],
                default: "next",
              },
            },
          },
        },
        {
          $group: {
            _id: { date: "$date", period: "$period" },
            totalTickets: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id.date",
            totalTickets: 1,
            period: "$_id.period",
          },
        },
      ])
      .toArray();

    let resultMap = new Map(bookings.map((b) => [b.date, b]));
    let completeData = allDates.map((entry) => (resultMap.has(entry.date) ? resultMap.get(entry.date) : entry));

    return { completeData, startDateYearAgo: formatDate(startDateYearAgoCurrent), endDateYearAgo: formatDate(endDateYearAgoCurrent) };
  }
  async topClients() {
    const excludedUsers = await this.db
      .collection("users")
      .find({ role: { $lte: 75 } }, { projection: { email: 1 } })
      .toArray();
    const excludedEmails = excludedUsers.map((u: any) => u.email).filter(Boolean);

    return this.db
      .collection("bookings")
      .aggregate([
        {
          $match: {
            status: "confirmed",
            "user.mail": { $nin: excludedEmails },
          },
        },
        {
          $addFields: {
            bookingValue: {
              $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }],
            },
          },
        },
        {
          $group: {
            _id: "$userId",
            totalSpent: { $sum: "$bookingValue" },
            totalBookings: { $sum: 1 },
            userName: { $first: "$user.name" },
            userEmail: { $first: "$user.mail" },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            userId: "$_id",
            totalSpent: 1,
            totalBookings: 1,
            userName: 1,
            userEmail: 1,
          },
        },
      ])
      .toArray();
  }

  async recentPurchases(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const convertStage = {
      $addFields: {
        userIdObj: {
          $convert: {
            input: "$userId",
            to: "objectId",
            onError: null,
            onNull: null,
          },
        },
      },
    };
    const lookupStage = {
      $lookup: {
        from: "users",
        localField: "userIdObj",
        foreignField: "_id",
        as: "userDoc",
      },
    };
    const roleMatchStage = {
      $match: {
        $or: [{ userIdObj: null }, { userDoc: { $size: 0 } }, { "userDoc.role": { $gte: 100 } }],
      },
    };
    const [results, total] = await Promise.all([
      this.db
        .collection("bookings")
        .aggregate([
          { $match: { status: "confirmed" } },
          convertStage,
          lookupStage,
          roleMatchStage,
          {
            $unset: ["userDoc", "userIdObj"],
          },
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ])
        .toArray(),
      this.db
        .collection("bookings")
        .aggregate([{ $match: { status: "confirmed" } }, convertStage, lookupStage, roleMatchStage, { $count: "total" }])
        .toArray()
        .then((res) => (res.length > 0 ? res[0].total : 0)),
    ]);

    return { results, total, page, limit };
  }

  async andamentoVendite() {
    let today = new Date();

    let startDatePast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    startDatePast.setHours(0, 0, 0, 0);

    let endDatePast = new Date(today.getFullYear(), today.getMonth(), 0);
    endDatePast.setHours(23, 59, 59, 999);

    let startDateCurrent = new Date(today.getFullYear(), today.getMonth(), 1);
    startDateCurrent.setHours(0, 0, 0, 0);

    let endDateCurrent = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endDateCurrent.setHours(23, 59, 59, 999);

    let startDateNext = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    startDateNext.setHours(0, 0, 0, 0);

    let endDateNext = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    endDateNext.setHours(23, 59, 59, 999);

    let startDateYearAgo = new Date(today.getFullYear() - 1, today.getMonth() - 1, 1);
    startDateYearAgo.setHours(0, 0, 0, 0);

    let endDateYearAgo = new Date(today.getFullYear() - 1, today.getMonth() + 2, 0);
    endDateYearAgo.setHours(23, 59, 59, 999);

    let startDateYearAgoCurrent = new Date(today.getFullYear() - 1, today.getMonth(), 1);
    startDateYearAgoCurrent.setHours(0, 0, 0, 0);

    let endDateYearAgoCurrent = new Date(today.getFullYear() - 1, today.getMonth() + 1, 0);
    endDateYearAgoCurrent.setHours(23, 59, 59, 999);

    const formatDate = (date: any) => date.toISOString().split("T")[0];

    const generateDateRange = (start: any, end: any, period: any) => {
      let dates = [];
      let currentDate = new Date(start);
      while (currentDate <= end) {
        dates.push({ date: formatDate(currentDate), totalTickets: 0, period });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return dates;
    };

    let allDates = [
      ...generateDateRange(startDatePast, endDatePast, "past"),
      ...generateDateRange(startDateCurrent, endDateCurrent, "current"),
      ...generateDateRange(startDateNext, endDateNext, "next"),
      ...generateDateRange(startDateYearAgo, endDateYearAgo, "yearAgo"),
    ];

    let bookings = await this.db
      .collection("bookings")
      .aggregate([
        {
          $match: {
            date: {
              $gte: formatDate(startDateYearAgo),
              $lte: formatDate(endDateNext),
            },
            status: { $eq: "confirmed" },
          },
        },
        {
          $addFields: {
            period: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [{ $gte: ["$date", formatDate(startDateCurrent)] }, { $lte: ["$date", formatDate(endDateCurrent)] }],
                    },
                    then: "current",
                  },
                  {
                    case: {
                      $and: [{ $gte: ["$date", formatDate(startDateYearAgo)] }, { $lte: ["$date", formatDate(endDateYearAgo)] }],
                    },
                    then: "yearAgo",
                  },
                  {
                    case: {
                      $and: [{ $gte: ["$date", formatDate(startDatePast)] }, { $lte: ["$date", formatDate(endDatePast)] }],
                    },
                    then: "past",
                  },
                ],
                default: "next",
              },
            },
            bookingValue: {
              $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }],
            },
          },
        },
        {
          $group: {
            _id: { date: "$date", period: "$period" },
            totalRevenue: { $sum: "$bookingValue" },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id.date",
            period: "$_id.period",
            totalRevenue: 1,
          },
        },
      ])
      .toArray();

    let resultMap = new Map(bookings.map((b) => [b.date, b]));
    let completeData = allDates.map((entry) => (resultMap.has(entry.date) ? resultMap.get(entry.date) : entry));

    return { completeData, startDateYearAgo: formatDate(startDateYearAgoCurrent), endDateYearAgo: formatDate(endDateYearAgoCurrent) };
  }

  async yearlyStats() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const previousYear = currentYear - 1;

    const startCurrentYear = `${currentYear}-01-01`;
    const endCurrentYear = `${currentYear}-12-31`;
    const startPreviousYear = `${previousYear}-01-01`;
    const endPreviousYear = `${previousYear}-12-31`;

    const [currentYearStats, previousYearStats] = await Promise.all([
      this.db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              date: { $gte: startCurrentYear, $lte: endCurrentYear },
              status: "confirmed",
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
              totalTickets: { $sum: 1 },
            },
          },
        ])
        .toArray(),
      this.db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              date: { $gte: startPreviousYear, $lte: endPreviousYear },
              status: "confirmed",
            },
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
              totalTickets: { $sum: 1 },
            },
          },
        ])
        .toArray(),
    ]);

    return {
      currentYear: {
        year: currentYear,
        revenue: currentYearStats.length > 0 ? currentYearStats[0].totalRevenue : 0,
        tickets: currentYearStats.length > 0 ? currentYearStats[0].totalTickets : 0,
      },
      previousYear: {
        year: previousYear,
        revenue: previousYearStats.length > 0 ? previousYearStats[0].totalRevenue : 0,
        tickets: previousYearStats.length > 0 ? previousYearStats[0].totalTickets : 0,
      },
    };
  }

  async yearlyComparison() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const previousYear = currentYear - 1;

    const [currentYearMonthly, previousYearMonthly] = await Promise.all([
      this.db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              date: { $gte: `${currentYear}-01-01`, $lte: `${currentYear}-12-31` },
              status: "confirmed",
            },
          },
          {
            $group: {
              _id: { $substr: ["$date", 5, 2] },
              revenue: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
              tickets: { $sum: 1 },
              seats: { $sum: "$seats" },
            },
          },
        ])
        .toArray(),
      this.db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              date: { $gte: `${previousYear}-01-01`, $lte: `${previousYear}-12-31` },
              status: "confirmed",
            },
          },
          {
            $group: {
              _id: { $substr: ["$date", 5, 2] },
              revenue: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
              tickets: { $sum: 1 },
              seats: { $sum: "$seats" },
            },
          },
        ])
        .toArray(),
    ]);

    const monthNames = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

    const currentMap = new Map(currentYearMonthly.map((r: any) => [r._id, r]));
    const previousMap = new Map(previousYearMonthly.map((r: any) => [r._id, r]));

    const months = Array.from({ length: 12 }, (_, i) => {
      const key = String(i + 1).padStart(2, "0");
      const c = currentMap.get(key);
      const p = previousMap.get(key);
      return {
        month: i,
        label: monthNames[i],
        key,
        current: { revenue: c?.revenue || 0, tickets: c?.tickets || 0, seats: c?.seats || 0 },
        previous: { revenue: p?.revenue || 0, tickets: p?.tickets || 0, seats: p?.seats || 0 },
      };
    });

    const currentTotal = months.reduce((acc, m) => {
      acc.revenue += m.current.revenue;
      acc.tickets += m.current.tickets;
      acc.seats += m.current.seats;
      return acc;
    }, { revenue: 0, tickets: 0, seats: 0 });

    const previousTotal = months.reduce((acc, m) => {
      acc.revenue += m.previous.revenue;
      acc.tickets += m.previous.tickets;
      acc.seats += m.previous.seats;
      return acc;
    }, { revenue: 0, tickets: 0, seats: 0 });

    const pctChange = (curr: number, prev: number) =>
      prev > 0 ? +((curr - prev) / prev * 100).toFixed(1) : 0;

    return {
      currentYear,
      previousYear,
      currentTotal,
      previousTotal,
      revenueChange: pctChange(currentTotal.revenue, previousTotal.revenue),
      ticketsChange: pctChange(currentTotal.tickets, previousTotal.tickets),
      seatsChange: pctChange(currentTotal.seats, previousTotal.seats),
      avgTicketCurrent: currentTotal.tickets > 0 ? +(currentTotal.revenue / currentTotal.tickets).toFixed(2) : 0,
      avgTicketPrevious: previousTotal.tickets > 0 ? +(previousTotal.revenue / previousTotal.tickets).toFixed(2) : 0,
      avgTicketChange: previousTotal.tickets > 0
        ? +(((currentTotal.revenue / currentTotal.tickets) - (previousTotal.revenue / previousTotal.tickets)) / (previousTotal.revenue / previousTotal.tickets) * 100).toFixed(1)
        : 0,
      months,
    };
  }

  async tratteYearlyComparison() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const previousYear = currentYear - 1;

    const [currentYearByTratta, previousYearByTratta] = await Promise.all([
      this.db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              date: { $gte: `${currentYear}-01-01`, $lte: `${currentYear}-12-31` },
              status: "confirmed",
            },
          },
          {
            $group: {
              _id: {
                routeId: "$routeId",
                fromId: "$from.id",
                toId: "$to.id",
              },
              routeName: { $first: "$name" },
              fromName: { $first: "$from.name" },
              toName: { $first: "$to.name" },
              bookings: { $sum: 1 },
              seats: { $sum: "$seats" },
              revenue: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
            },
          },
        ])
        .toArray(),
      this.db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              date: { $gte: `${previousYear}-01-01`, $lte: `${previousYear}-12-31` },
              status: "confirmed",
            },
          },
          {
            $group: {
              _id: {
                routeId: "$routeId",
                fromId: "$from.id",
                toId: "$to.id",
              },
              routeName: { $first: "$name" },
              fromName: { $first: "$from.name" },
              toName: { $first: "$to.name" },
              bookings: { $sum: 1 },
              seats: { $sum: "$seats" },
              revenue: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
            },
          },
        ])
        .toArray(),
    ]);

    const key = (r: any) => `${r._id.routeId}|${r._id.fromId}|${r._id.toId}`;
    const currentMap = new Map(currentYearByTratta.map((r: any) => [key(r), r]));
    const previousMap = new Map(previousYearByTratta.map((r: any) => [key(r), r]));

    const pct = (curr: number, prev: number) => {
      if (prev <= 0) return curr > 0 ? null : 0;
      return +(((curr - prev) / prev) * 100).toFixed(1);
    };

    const linesMap = new Map<string, any>();

    for (const [k, c] of currentMap) {
      const p = previousMap.get(k);
      linesMap.set(c._id.routeId, linesMap.get(c._id.routeId) || { name: c.routeName, tratte: new Map() });
      const line = linesMap.get(c._id.routeId);
      line.tratte.set(k, {
        fromId: c._id.fromId,
        toId: c._id.toId,
        fromName: c.fromName,
        toName: c.toName,
        current: { bookings: c.bookings, seats: c.seats, revenue: c.revenue },
        previous: { bookings: p?.bookings || 0, seats: p?.seats || 0, revenue: p?.revenue || 0 },
        bookingsChange: pct(c.bookings, p?.bookings || 0),
      });
    }

    for (const [k, p] of previousMap) {
      if (!currentMap.has(k)) {
        linesMap.set(p._id.routeId, linesMap.get(p._id.routeId) || { name: p.routeName, tratte: new Map() });
        const line = linesMap.get(p._id.routeId);
        line.tratte.set(k, {
          fromId: p._id.fromId,
          toId: p._id.toId,
          fromName: p.fromName,
          toName: p.toName,
          current: { bookings: 0, seats: 0, revenue: 0 },
          previous: { bookings: p.bookings, seats: p.seats, revenue: p.revenue },
          bookingsChange: pct(0, p.bookings),
        });
      }
    }

    const lines = Array.from(linesMap.entries()).map(([routeId, line]: [string, any]) => {
      const tratte = Array.from(line.tratte.values()).sort(
        (a: any, b: any) =>
          b.current.bookings - a.current.bookings || b.previous.bookings - a.previous.bookings,
      );
      const sumTotals = (key: "current" | "previous") =>
        tratte.reduce(
          (acc: { bookings: number; seats: number; revenue: number }, t: any) => {
            acc.bookings += t[key].bookings;
            acc.seats += t[key].seats;
            acc.revenue += t[key].revenue;
            return acc;
          },
          { bookings: 0, seats: 0, revenue: 0 },
        );
      const current = sumTotals("current");
      const previous = sumTotals("previous");
      return {
        routeId,
        routeName: line.name || null,
        current,
        previous,
        bookingsChange: pct(current.bookings, previous.bookings),
        tratte,
      };
    });

    lines.sort((a: any, b: any) => b.current.bookings - a.current.bookings || b.previous.bookings - a.previous.bookings);

    return {
      currentYear,
      previousYear,
      lines,
    };
  }

  async fasceOrarieYearlyComparison() {
    const today = new Date();
    const currentYear = today.getFullYear();
    const previousYear = currentYear - 1;

    const yearlyBookings = (year: number) =>
      this.db
        .collection("bookings")
        .aggregate([
          {
            $match: {
              date: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
              status: "confirmed",
            },
          },
          {
            $group: {
              _id: {
                routeId: "$routeId",
                scheduleId: "$scheduleId",
              },
              bookings: { $sum: 1 },
              seats: { $sum: "$seats" },
              revenue: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
            },
          },
        ])
        .toArray();

    const [currentYearBySchedule, previousYearBySchedule, schedules] = await Promise.all([
      yearlyBookings(currentYear),
      yearlyBookings(previousYear),
      this.db
        .collection("routes")
        .aggregate([
          { $unwind: "$schedules" },
          {
            $project: {
              _id: 0,
              scheduleId: "$schedules.id",
              routeId: "$id",
              routeName: "$name",
              stops: "$schedules.stops",
            },
          },
        ])
        .toArray(),
    ]);

    const scheduleMap = new Map<string, { routeId: string; routeName: any; departureTime: string }>();
    for (const s of schedules) {
      if (!s.scheduleId || scheduleMap.has(s.scheduleId)) continue;
      const firstActiveStop = (s.stops || []).find((st: any) => st.status === "active");
      scheduleMap.set(s.scheduleId, {
        routeId: s.routeId,
        routeName: s.routeName,
        departureTime: firstActiveStop?.stopTime || "",
      });
    }

    const slotsMap = new Map<string, any>();
    const ensureSlot = (routeId: string, departureTime: string, routeName: any) => {
      const k = `${routeId}|${departureTime}`;
      if (!slotsMap.has(k)) {
        slotsMap.set(k, {
          routeId,
          routeName: routeName || null,
          departureTime,
          current: { bookings: 0, seats: 0, revenue: 0 },
          previous: { bookings: 0, seats: 0, revenue: 0 },
        });
      }
      return slotsMap.get(k);
    };

    for (const c of currentYearBySchedule) {
      const info = scheduleMap.get(c._id.scheduleId);
      const slot = ensureSlot(c._id.routeId, info?.departureTime || "", info?.routeName);
      slot.current.bookings += c.bookings;
      slot.current.seats += c.seats;
      slot.current.revenue += c.revenue;
    }

    for (const p of previousYearBySchedule) {
      const info = scheduleMap.get(p._id.scheduleId);
      const slot = ensureSlot(p._id.routeId, info?.departureTime || "", info?.routeName);
      slot.previous.bookings += p.bookings;
      slot.previous.seats += p.seats;
      slot.previous.revenue += p.revenue;
    }

    const pct = (curr: number, prev: number) => {
      if (prev <= 0) return curr > 0 ? null : 0;
      return +(((curr - prev) / prev) * 100).toFixed(1);
    };

    const slots = Array.from(slotsMap.values()).map((s) => ({
      ...s,
      bookingsChange: pct(s.current.bookings, s.previous.bookings),
    }));

    slots.sort(
      (a: any, b: any) =>
        b.current.bookings - a.current.bookings ||
        b.previous.bookings - a.previous.bookings ||
        a.departureTime.localeCompare(b.departureTime),
    );

    return {
      currentYear,
      previousYear,
      slots,
    };
  }

k  async hasTicketForRoute(userId: string, routeId: string, date: string, fromStopId: string, toStopId: string): Promise<boolean> {
    const result = await this.db.collection("bookings").findOne({
      userId,
      routeId,
      date,
      "from.id": fromStopId,
      "to.id": toStopId,
      status: { $in: ["confirmed"] },
    });
    return !!result;
  }

  async revenueByPaymentMethod(startDate?: string, endDate?: string) {
    let match: any = { status: "confirmed" };
    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = startDate;
      if (endDate) match.date.$lte = endDate;
    }
    return this.db
      .collection("bookings")
      .aggregate([
        { $match: match },
        {
          $group: {
            _id: "$paymentMethod",
            total: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();
  }

  async dailyRevenueByRoute(date: string) {
    const dateObj = new Date(date + "T00:00:00");
    const dayOfWeek = (dateObj.getDay() + 6) % 7;

    const schedules = await this.db
      .collection("routes")
      .aggregate([
        { $unwind: "$schedules" },
        {
          $match: {
            "schedules.status": "active",
            "schedules.startDate": { $lte: date },
            "schedules.endDate": { $gte: date },
            $or: [
              { "schedules.extraDates": { $elemMatch: { $eq: date } } },
              {
                $and: [{ "schedules.daysOfWeek": { $not: { $elemMatch: { $eq: dayOfWeek } } } }, { "schedules.excludedDates": { $nin: [date] } }],
              },
            ],
          },
        },
        {
          $project: {
            _id: 0,
            scheduleId: "$schedules.id",
            routeId: "$id",
            routeName: "$name",
            totalSeats: "$schedules.totalSeats",
            stops: "$schedules.stops",
          },
        },
      ])
      .toArray();

    const bookings = await this.db
      .collection("bookings")
      .aggregate([
        { $match: { date, status: "confirmed" } },
        {
          $group: {
            _id: {
              scheduleId: "$scheduleId",
              paymentMethod: "$paymentMethod",
            },
            total: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
            seats: { $sum: "$seats" },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.scheduleId",
            total: { $sum: "$total" },
            seats: { $sum: "$seats" },
            count: { $sum: "$count" },
            byPayment: {
              $push: {
                method: "$_id.paymentMethod",
                total: "$total",
                count: "$count",
              },
            },
          },
        },
      ])
      .toArray();

    const bookingMap = new Map(bookings.map((b: any) => [b._id, b]));

    const result: any[] = [];
    const processed = new Set<string>();

    for (const schedule of schedules) {
      const sid = schedule.scheduleId;
      processed.add(sid);
      const booking = bookingMap.get(sid);
      if (!booking) continue;
      const firstActiveStop = (schedule.stops || []).find((s: any) => s.status === "active");
      result.push({
        scheduleId: sid,
        routeId: schedule.routeId,
        routeName: schedule.routeName,
        totalSeats: schedule.totalSeats,
        departureTime: firstActiveStop?.stopTime || "",
        total: booking.total,
        seats: booking.seats,
        count: booking.count,
        byPayment: booking.byPayment,
      });
    }

    for (const [sid, booking] of bookingMap) {
      if (!processed.has(sid)) {
        result.push({
          scheduleId: sid,
          routeId: "",
          routeName: { it: "Sconosciuto", en: "Unknown" },
          totalSeats: 0,
          total: booking.total,
          seats: booking.seats,
          count: booking.count,
          byPayment: booking.byPayment,
        });
      }
    }

    return result.sort((a: any, b: any) => b.total - a.total);
  }

  async getMonthlyRevenue() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

    const monthRanges: { label: string; prefix: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthRanges.push({
        label: d.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
        prefix,
      });
    }

    const confirmedByMonth = await this.db
      .collection("bookings")
      .aggregate([
        { $match: { status: "confirmed" } },
        {
          $group: {
            _id: { $substr: ["$date", 0, 7] },
            revenue: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const refundedByMonth = await this.db
      .collection("bookings")
      .aggregate([
        { $match: { status: "refunded" } },
        {
          $group: {
            _id: { $substr: ["$date", 0, 7] },
            refunds: { $sum: { $add: ["$total", { $multiply: ["$luggage", LUGGAGE_PRICE] }] } },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const revenueMap = new Map(confirmedByMonth.map((r: any) => [r._id, r.revenue]));
    const refundMap = new Map(refundedByMonth.map((r: any) => [r._id, r.refunds]));

    const getRevenue = (prefix: string) => revenueMap.get(prefix) || 0;
    const getRefunds = (prefix: string) => refundMap.get(prefix) || 0;

    const lastYearSameMonthDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    const lastYearSameMonth = `${lastYearSameMonthDate.getFullYear()}-${String(lastYearSameMonthDate.getMonth() + 1).padStart(2, "0")}`;

    const currentRevenue = getRevenue(currentMonth);
    const currentRefundTotal = getRefunds(currentMonth);
    const lastMonthRevenue = getRevenue(lastMonth);
    const lastMonthRefundTotal = getRefunds(lastMonth);
    const lastYearSameMonthRevenue = getRevenue(lastYearSameMonth);
    const lastYearSameMonthRefundTotal = getRefunds(lastYearSameMonth);

    const revenueChange = lastMonthRevenue > 0 ? ((currentRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;
    const refundChange = lastMonthRefundTotal > 0 ? ((currentRefundTotal - lastMonthRefundTotal) / lastMonthRefundTotal) * 100 : 0;

    const last6Months = monthRanges.map((mr) => ({
      month: mr.label,
      revenue: getRevenue(mr.prefix),
      refunds: getRefunds(mr.prefix),
    }));

    return {
      currentMonth: {
        revenue: currentRevenue,
        refunds: currentRefundTotal,
        net: currentRevenue - currentRefundTotal,
      },
      lastMonth: {
        revenue: lastMonthRevenue,
        refunds: lastMonthRefundTotal,
        net: lastMonthRevenue - lastMonthRefundTotal,
      },
      lastYearSameMonth: {
        revenue: lastYearSameMonthRevenue,
        refunds: lastYearSameMonthRefundTotal,
        net: lastYearSameMonthRevenue - lastYearSameMonthRefundTotal,
      },
      revenueChange: +revenueChange.toFixed(1),
      refundChange: +refundChange.toFixed(1),
      last6Months,
    };
  }
}
