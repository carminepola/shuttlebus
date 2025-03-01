import { Db, ClientSession } from "mongodb";
import { Schedule, ScheduleStop, PurchasedTicket, Booking, Stop } from "../../model/routeModel";

export default class ScheduleDAO {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  /** 📌 1. Creare una nuova Schedule */
  async createSchedule(schedule: Schedule) {
    return this.db.collection("schedules").insertOne(schedule);
  }

  /** 📌 2. Ottenere una Schedule per ID */
  async getScheduleById(scheduleId: string, session?: ClientSession) {
    return this.db.collection("schedules").findOne({ id: scheduleId }, { session });
  }
  /** 📌 3. Controllare la disponibilità di posti su una tratta */
  async getAvailability(scheduleId: string, fromStopId: string, toStopId: string, session?: ClientSession) {
    const schedule = await this.getScheduleById(scheduleId, session);
    if (!schedule) return null;

    const activeStops = schedule.stops.filter((stop: ScheduleStop) => stop.status === "active").map((s: ScheduleStop) => s.id);

    const bookings = await this.db
      .collection("bookings")
      .find(
        {
          scheduleId,
          status: { $in: ["pending", "confirmed"] },
        },
        { session }
      )
      .toArray();

    let maxSeatsUsed = 0;

    bookings.forEach((booking) => {
      if (!activeStops.includes(booking.boardingStopId) || !activeStops.includes(booking.destinationStopId)) {
        return;
      }

      let isOnBus = false;
      schedule.stops.forEach((stop: ScheduleStop) => {
        if (stop.id === booking.boardingStopId) isOnBus = true;
        if (isOnBus) maxSeatsUsed += booking.purchasedTickets.reduce((sum: number, t: PurchasedTicket) => sum + t.quantity, 0);
        if (stop.id === booking.destinationStopId) isOnBus = false;
      });
    });

    return {
      availableSeats: schedule.totalSeats - maxSeatsUsed,
    };
  }

  /** 📌 4. Creare una prenotazione */
  async bookSeats(booking: Booking, session?: ClientSession) {
    return this.db.collection("bookings").insertOne(booking, { session: session || undefined });
  }

  /** 📌 5. Confermare una prenotazione */
  async confirmBooking(bookingId: string) {
    return this.db.collection("bookings").updateOne({ bookingId }, { $set: { status: "confirmed" } });
  }

  /** 📌 7. Restituire una prenotazione */
  async refundBooking(bookingId: string) {
    return this.db.collection("bookings").updateOne({ bookingId }, { $set: { status: "refunded" } });
  }

  /** 📌 8. Annullare una prenotazione */
  async cancelBooking(bookingId: string) {
    return this.db.collection("bookings").updateOne({ bookingId }, { $set: { status: "cancelled" } });
  }
  /** 📌 6. Pulizia automatica delle prenotazioni scadute */
  async expireOldBookings() {
    const now = new Date().getTime();
    const expirationTime = new Date(now - 5 * 60 * 1000).toISOString();
    await this.db.collection("bookings").deleteMany({ status: "pending", expirationTime: { $lte: expirationTime } });
  }
}
