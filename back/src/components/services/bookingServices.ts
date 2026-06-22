import { Db } from "mongodb";
import BookingDao from "../dao/bookingsDao";
import booking from "../../model/bookFromSiteModel";
import UserServices from "./userServices";
import { client, logger } from "../../index";
import { ClientSession } from "mongodb";
import TicketTypeServices from "./ticketTypeServices";
import ErrorModel from "../../model/errorModel";
import PaymentServices from "./paymentServices";
import RoutesServices from "./routesServices";
import MailSenderServices from "./mailSender";
import TelegramServices from "./telegramServices";
import { role } from "../../enum/role";
import { LUGGAGE_PRICE } from "../../constants";

class BookingsServices {
  private bookingDao: BookingDao;
  private userServices: UserServices;
  private ticketTypeServices: TicketTypeServices;
  private paymentServices: PaymentServices;
  private routeServices: RoutesServices;
  private mailSenderServices: MailSenderServices;
  private telegramServices: TelegramServices;

  constructor(db: Db) {
    this.bookingDao = new BookingDao(db);
    this.userServices = new UserServices(db);
    this.ticketTypeServices = new TicketTypeServices(db);
    this.paymentServices = new PaymentServices(db);
    this.routeServices = new RoutesServices(db);
    this.mailSenderServices = new MailSenderServices(db);
    this.telegramServices = new TelegramServices();
  }

  async findAvailableRoutes(travelDate: string, fromStopId: string, toStopId: string, posti: number = 1, bagagli: number = 0) {
    await this.removeExpiredPendingBookings();
    return await this.bookingDao.findAvailableRoutes(travelDate, fromStopId, toStopId, posti, bagagli);
  }

  async availableSeats(travelDate: string, routeId: string, scheduleId: string, fromStopId: string, toStopId: string, session?: ClientSession) {
    let ris = await this.bookingDao.availableSeats(travelDate, routeId, scheduleId, fromStopId, toStopId, session);
    return ris.length > 0 ? ris[0] : { availableSeats: 0, availableLuggage: 0 };
  }

  async insertBooking(ticket: any, userId: string) {
    let session: ClientSession = client.startSession();
    let paymentType = ticket.paymentType || "stripe";

    try {
      await this.removeExpiredPendingBookings();
      let booking = await this.removePendingBooking(userId);
      if (booking.length >= 3) throw new Error("str_error_pending_booking");
      await this.checkPriceAndTime(ticket);
    } catch (error) {
      throw error;
    }

    let book: booking;
    try {
      session.startTransaction();
      ticket.userId = userId;
      let user = await this.userServices.getUserById(userId);
      if (user) {
        ticket.user = {
          id: userId,
          name: user.details?.name,
          mail: user.email,
          phone: user.details?.phone,
        };
      } else {
        return;
      }

      book = new booking(ticket);

      let numeroPosti: any = await this.availableSeats(book.date, book.routeId, book.scheduleId, book.from.id, book.to.id, session);

      if (book.seats > numeroPosti.availableSeats) {
        throw new Error("str_error_seats");
      }
      if (book.luggage > 0 && book.luggage > numeroPosti.availableLuggage) {
        throw new Error("str_error_luggage");
      }

      switch (paymentType) {
        case "stripe":
          book.status = "pending";
          break;
        case "cash":
          if (user.role > role.DRIVER) {
            throw new Error("str_error_permission");
          }
          book.status = "confirmed";
          break;
      }

      let res = await this.bookingDao.insertBooking(book, session);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      throw error;
    }

    await session.endSession();

    try {
      let paymentSession: any = await this.paymentServices.calculatePayment(book, paymentType);
      let url: any = "";
      switch (paymentSession.type) {
        case "stripe":
          this.bookingDao.updatePaymentInfo("stripe", paymentSession.other, book.numberOfTickets);
          url = paymentSession.other.url;
          break;
        case "cash":
          this.bookingDao.updatePaymentInfo("cash", { type: "cash" }, book.numberOfTickets);
          let bookObj = await this.getBooking(book.numberOfTickets);
          if (process.env.MAIL_ADMIN) {
            await this.mailSenderServices.sendGenericMail(process.env.MAIL_ADMIN, "Conferma Prenotazione (Contanti)", this.mailSenderServices.transformBookGeneric(bookObj));
          }

          await this.telegramServices.sendMessage(this.telegramServices.bookToMessage(bookObj, "✅ *Prenotazione Confermata (Contanti)* ✅"));
          return { type: "cash", bookingId: book.numberOfTickets };
      }
      if (url == "") {
        throw new Error("str_error_payment");
      }
      return url;
    } catch (error) {
      this.bookingDao.deleteBooking(book.numberOfTickets);
      throw error;
    }
  }
  async removeExpiredPendingBookings() {
    return await this.bookingDao.removeExpiredPendingBookings();
  }
  async readBookingConfirmed(date: string, routeId: string, scheduleId: string, status: string) {
    return await this.bookingDao.readBookingConfirmed(date, routeId, scheduleId, status);
  }
  async getBookingFromUser(userId: string) {
    return await this.bookingDao.getBookingFromUser(userId);
  }
  async checkPriceAndTime(ticket: any) {
    let totale = ticket.total;
    let newTotale = 0;
    let count = 0;
    let ticketType = await this.ticketTypeServices.getAllActiveTicketTypes();

    let day = ticket.date;

    if (new Date(day).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
      throw new ErrorModel(400, "str_error_time");
    }

    let route = await this.routeServices.getRouteById(ticket.routeId);
    if (route && route.enabled) {
      let schedule = route.schedules.find((s: any) => s.id == ticket.scheduleId);
      if (schedule && schedule.status == "active") {
        if (new Date(day).setHours(0, 0, 0, 0) == new Date().setHours(0, 0, 0, 0)) {
          if (new Date(schedule.startDate).getTime() <= new Date(day).getTime() && new Date(schedule.endDate).getTime() >= new Date(day).getTime()) {
            let t = schedule.departureTime.split(":");
            let time = parseInt(t[0]) * 60 + parseInt(t[1]) - 120;
            let now = new Date().getHours() * 60 + new Date().getMinutes();
            if (now > time) {
              throw new ErrorModel(400, "str_error_time");
            }
          }
        }
      }
    } else {
      throw new ErrorModel(400, "str_error_time");
    }

    // let now = new Date();
    // let checkTime = new Date(`${day}T${time}`);

    // let threeHoursFromNow = new Date(checkTime.getTime() - 3 * 60 * 60 * 1000);

    // if (now >= threeHoursFromNow) {
    //   throw new ErrorModel(400, "str_error_time");
    // }

    if (ticketType && ticket.ticketTypes.length > 0) {
      for (let t of ticket.ticketTypes) {
        let find = ticketType.find((tt: any) => tt.id === t.id);
        if (find) {
          count += t.count;
          newTotale += find.cost * t.count;
        } else {
          continue;
        }
      }
    }
    newTotale += ticket.luggage * LUGGAGE_PRICE;
    if (count == ticket.seats && newTotale == totale && totale > 0 && ticket.seats > 0) {
      return true;
    }

    throw new ErrorModel(400, "str_error_check_price");
  }

  async updatePaymentIntentId(numberOfTickets: string, paymentIntentId: string) {
    return await this.bookingDao.updatePaymentIntentId(numberOfTickets, paymentIntentId);
  }
  async readByPaymentIntentId(paymentIntentId: string) {
    return await this.bookingDao.readByPaymentIntentId(paymentIntentId);
  }
  async updatePaymentInfo(type: string, other: any, numberOfTickets: string) {
    return await this.bookingDao.updatePaymentInfo(type, other, numberOfTickets);
  }
  async getBooking(numberOfTickets: string): Promise<booking> {
    return new booking(await this.bookingDao.getBooking(numberOfTickets));
  }

  async scanTicket(numberOfTickets: string, driverId: string, driverName: string) {
    const bookingRaw = await this.bookingDao.getBooking(numberOfTickets);
    if (!bookingRaw || bookingRaw.status !== "confirmed") {
      return { found: false };
    }

    const today = new Date().toISOString().split("T")[0];
    if (bookingRaw.date !== today) {
      return { found: true, wrongDate: true, booking: bookingRaw };
    }

    try {
      const route = await this.routeServices.getRouteById(bookingRaw.routeId);
      if (route) {
        const schedule = route.schedules?.find((s: any) => s.id === bookingRaw.scheduleId);
        if (schedule?.departureTime) {
          const parts = schedule.departureTime.split(":");
          const depMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
          const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
          const diff = nowMinutes - depMinutes;
          if (diff < -30 || diff > 30) {
            return { found: true, wrongTime: true, departureTime: schedule.departureTime, booking: bookingRaw };
          }
        }
      }
    } catch {}

    return await this.bookingDao.scanBooking(numberOfTickets, driverId, driverName);
  }
  async cancelBooking(numberOfTickets: string, cancelMotivation?: string) {
    let success = await this.bookingDao.cancelBooking(numberOfTickets, cancelMotivation);
    if (success) {
      let book = await this.getBooking(numberOfTickets);

      if ((book.paymentMethod as any) !== "cash") {
        await this.mailSenderServices.sendCancelBook(book.user.mail, book.user.name, numberOfTickets, book.lng);
      }

      if (process.env.MAIL_ADMIN) {
        await this.mailSenderServices.sendGenericMail(process.env.MAIL_ADMIN, "Annullamento", this.mailSenderServices.transformBookGeneric(book));
      }

      await this.telegramServices.sendMessage(this.telegramServices.bookToMessage(book, "🛑 *Annullo Prenotazione* 🛑"));
    }
    return success;
  }

  async refundBooking(numberOfTickets: string, userId?: string) {
    let book = await this.getBooking(numberOfTickets);
    if (new Date(book.date).getTime() - 3 * 24 * 60 * 60 * 1000 < new Date().getTime()) {
      throw new ErrorModel(400, "str_error_refund");
    }
    let success = await this.bookingDao.refundBooking(numberOfTickets, userId);
    if (success) {
      //manda mail rimborsato biglietto
      await this.mailSenderServices.sendRefoundBook(book.user.mail, book.user.name, book.total.toString(), numberOfTickets, book.lng);
      await this.mailSenderServices.sendGenericMail(process.env.MAIL_ADMIN || "pintour@yopmail.com", "Rimborso", this.mailSenderServices.transformBookGeneric(book));
      await this.telegramServices.sendMessage(this.telegramServices.bookToMessage(book, "💸 *Rimborso Prenotazione* 💸"));
    }
    return success;
  }
  async refundBookingAdmin(numberOfTickets: string, userId?: string) {
    let book = await this.getBooking(numberOfTickets);

    let success = await this.bookingDao.refundBooking(numberOfTickets, userId);
    if (success) {
      await this.mailSenderServices.sendRefoundBook(book.user.mail, book.user.name, book.total.toString(), numberOfTickets, book.lng);
      await this.mailSenderServices.sendGenericMail(process.env.MAIL_ADMIN || "pintour@yopmail.com", "Rimborso", this.mailSenderServices.transformBookGeneric(book));
      await this.telegramServices.sendMessage(this.telegramServices.bookToMessage(book, "💸 *Rimborso Prenotazione* 💸"));
    }
    return success;
  }
  async partialRefundBookingAdmin(numberOfTickets: string, amount: number, items: { ticketTypeId: string; count: number }[], refundedSeats: number, refundedLuggage: number, userId?: string) {
    let success = await this.bookingDao.partialRefundBooking(numberOfTickets, items, amount, refundedSeats, refundedLuggage, userId);
    if (success) {
      let book = await this.getBooking(numberOfTickets);
      await this.mailSenderServices.sendRefoundBook(book.user.mail, book.user.name, amount.toString(), numberOfTickets, book.lng);
      await this.mailSenderServices.sendGenericMail(process.env.MAIL_ADMIN || "pintour@yopmail.com", "Rimborso Parziale", this.mailSenderServices.transformBookGeneric(book));
      await this.telegramServices.sendMessage(this.telegramServices.bookToMessage(book, "💸 *Rimborso Parziale Prenotazione* 💸"));
    }
    return success;
  }
  async confirmBooking(numberOfTickets: string, stripeSessionId?: string) {
    let success = await this.bookingDao.confirmBooking(numberOfTickets, stripeSessionId);

    //l'invio di questa notifica è demandato altrove

    return success;
  }
  async sendConfirmation(numberOfTickets: string, typePayment?: string) {
    logger.info(`Invio conferma per la prenotazione ${numberOfTickets}`);
    let book = await this.getBooking(numberOfTickets);

    await this.mailSenderServices.sendConfirmBook(
      book.user.mail,
      book.user.name,
      numberOfTickets,
      book.total.toString(),
      typePayment || "stripe",
      this.mailSenderServices.transformBook(book),
      book.lng,
    );
    await this.mailSenderServices.sendGenericMail(process.env.MAIL_ADMIN || "pintour@yopmail.com", "Conferma Prenotazione", this.mailSenderServices.transformBookGeneric(book));
    await this.telegramServices.sendMessage(this.telegramServices.bookToMessage(book, "✅ *Prenotazione Confermata* ✅"));
  }
  async deleteBooking(numberOfTickets: string, userId?: string) {
    return await this.bookingDao.deleteBooking(numberOfTickets, userId);
  }
  async expireTicketById(ticketId: string) {
    return await this.bookingDao.expireTicketById(ticketId);
  }
  async removePendingBooking(userId: string) {
    let booking: any = await this.bookingDao.readPendingBookingForUser(userId);

    return booking;
  }
  async ticketToDay() {
    return await this.bookingDao.ticketToDay();
  }
  async seatsToDay() {
    return await this.bookingDao.seatsToDay();
  }
  async andamento() {
    return await this.bookingDao.andamento();
  }
  async currentDayBookingsFromScheduleId(bookingId: string) {
    return await this.bookingDao.currentDayBookingsFromScheduleId(bookingId);
  }
  async andamentoVendite() {
    return await this.bookingDao.andamentoVendite();
  }
  async yearlyStats() {
    return await this.bookingDao.yearlyStats();
  }
  async topClients() {
    return await this.bookingDao.topClients();
  }
  async recentPurchases(page: number = 1, limit: number = 20) {
    return await this.bookingDao.recentPurchases(page, limit);
  }

  async dashboardStats() {
    const db = (this.bookingDao as any).db;
    const bookingsCollection = db.collection("bookings");
    const usersCollection = db.collection("users");

    const conversionStats = await bookingsCollection
      .aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    let confirmed = 0;
    let expired = 0;
    let cancelled = 0;
    let deleted = 0;

    for (const stat of conversionStats) {
      if (stat._id === "confirmed") confirmed = stat.count;
      if (stat._id === "expired") expired = stat.count;
      if (stat._id === "cancelled") cancelled = stat.count;
      if (stat._id === "deleted") deleted = stat.count;
    }

    const total = confirmed + expired + cancelled + deleted;
    const abandoned = expired + cancelled + deleted;
    const conversionRate = total > 0 ? ((confirmed / total) * 100).toFixed(1) : "0";
    const abandonRate = total > 0 ? ((abandoned / total) * 100).toFixed(1) : "0";

    const registrationStats = await usersCollection
      .aggregate([
        {
          $group: {
            _id: {
              $cond: [{ $ifNull: ["$options.google", false] }, "google", "email"],
            },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    let googleCount = 0;
    let emailCount = 0;
    for (const stat of registrationStats) {
      if (stat._id === "google") googleCount = stat.count;
      if (stat._id === "email") emailCount = stat.count;
    }

    return {
      conversion: {
        confirmed,
        abandoned,
        total,
        conversionRate: parseFloat(conversionRate),
        abandonRate: parseFloat(abandonRate),
      },
      registrations: {
        google: googleCount,
        email: emailCount,
        total: googleCount + emailCount,
      },
    };
  }

  async hasTicketForRoute(userId: string, routeId: string, date: string, fromStopId: string, toStopId: string): Promise<boolean> {
    return await this.bookingDao.hasTicketForRoute(userId, routeId, date, fromStopId, toStopId);
  }

  async revenueByPaymentMethod(startDate?: string, endDate?: string) {
    const raw = await this.bookingDao.revenueByPaymentMethod(startDate, endDate);
    let stripe = 0,
      cash = 0,
      stripeCount = 0,
      cashCount = 0;
    for (const row of raw) {
      const method = typeof row._id === "string" ? row._id : row._id?.type || "unknown";
      if (method === "stripe") {
        stripe += row.total;
        stripeCount += row.count;
      } else if (method === "cash") {
        cash += row.total;
        cashCount += row.count;
      }
    }
    return { stripe, cash, stripeCount, cashCount, total: stripe + cash };
  }

  async dailyRevenueByRoute(date: string) {
    return await this.bookingDao.dailyRevenueByRoute(date);
  }

  async getMonthlyRevenue() {
    return await this.bookingDao.getMonthlyRevenue();
  }

  async yearlyComparison() {
    return await this.bookingDao.yearlyComparison();
  }
}

export default BookingsServices;
