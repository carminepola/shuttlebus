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
    try {
      await this.removeExpiredPendingBookings();
      let booking = await this.removePendingBooking(userId);
      if (booking.length >= 3) throw new Error("str_error_pending_booking");
      await this.checkPriceAndTime(ticket);
    } catch (error) {
      throw error;
    }

    try {
      session.startTransaction();
      ticket.userId = userId;
      let user = await this.userServices.getUserById(userId);
      if (user) {
        ticket.user = {
          name: user.details?.name,
          mail: user.email,
          phone: user.details?.phone,
        };
      }

      let book: booking = new booking(ticket);

      let numeroPosti: any = await this.availableSeats(book.date, book.routeId, book.scheduleId, book.from.id, book.to.id, session);

      if (book.seats > numeroPosti.availableSeats) {
        throw new Error("str_error_seats");
      }
      if (book.luggage > 0 && book.luggage > numeroPosti.availableLuggage) {
        throw new Error("str_error_luggage");
      }

      let res = await this.bookingDao.insertBooking(book, session);

      await session.commitTransaction();

      await session.endSession();

      let paymentSession: any = await this.paymentServices.calculatePayment(book);
      let url: any = "";
      switch (paymentSession.type) {
        case "stripe":
          this.bookingDao.updatePaymentInfo("stripe", paymentSession.other, book.numberOfTickets);
          url = paymentSession.other.url;
          break;
      }
      if (url == "") {
        throw new Error("str_error_payment");
      }

      return url;
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      this.bookingDao.deleteBooking(ticket.numberOfTickets);
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
    newTotale += ticket.luggage * 2;
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
  async cancelBooking(numberOfTickets: string, cancelMotivation?: string) {
    let success = await this.bookingDao.cancelBooking(numberOfTickets, cancelMotivation);
    if (success) {
      let book = await this.getBooking(numberOfTickets);

      //manda mail annullato biglietto

      await this.mailSenderServices.sendCancelBook(book.user.mail, book.user.name, numberOfTickets, book.lng);

      await this.mailSenderServices.sendGenericMail(process.env.MAIL_ADMIN || "pintour@yopmail.com", "Annullamento", this.mailSenderServices.transformBookGeneric(book));

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
  async confirmBooking(numberOfTickets: string) {
    let success = await this.bookingDao.confirmBooking(numberOfTickets);

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
      book.lng
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
}

export default BookingsServices;
