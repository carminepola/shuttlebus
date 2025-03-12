import { Db } from "mongodb";
import BookingDao from "../dao/bookingsDao";
import booking from "../../model/bookFromSiteModel";
import UserServices from "./userServices";
import { client } from "../../index";
import { ClientSession } from "mongodb";
import TicketTypeServices from "./ticketTypeServices";
import ErrorModel from "../../model/errorModel";
import PaymentServices from "./paymentServices";
import StripeServices from "./stripeServices";
import { response } from "express";
import { use } from "passport";
import RoutesServices from "./routesServices";
class BookingsServices {
  private bookingDao: BookingDao;
  private userServices: UserServices;
  private ticketTypeServices: TicketTypeServices;
  private paymentServices: PaymentServices;
  private routeServices: RoutesServices;

  constructor(db: Db) {
    this.bookingDao = new BookingDao(db);
    this.userServices = new UserServices(db);
    this.ticketTypeServices = new TicketTypeServices(db);
    this.paymentServices = new PaymentServices(db);
    this.routeServices = new RoutesServices(db);
  }

  async findAvailableRoutes(travelDate: string, fromStopId: string, toStopId: string, posti: number = 1, bagagli: number = 0) {
    await this.removeExpiredPendingBookings();
    return await this.bookingDao.findAvailableRoutes(travelDate, fromStopId, toStopId, posti, bagagli);
  }

  async availableSeats(travelDate: string, routeId: string, scheduleId: string, session?: ClientSession) {
    let ris = await this.bookingDao.availableSeats(travelDate, routeId, scheduleId, session);
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

      let numeroPosti: any = await this.availableSeats(book.date, book.routeId, book.scheduleId, session);

      if (book.seats > numeroPosti.availableSeats) {
        throw new Error("str_error_seats");
      }
      if (book.luggage > numeroPosti.availableLuggage) {
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
  async readBookingConfirmed(date: string, routeId: string, scheduleId: string) {
    return await this.bookingDao.readBookingConfirmed(date, routeId, scheduleId);
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

    let route = await this.routeServices.getRouteById(ticket.routeId);
    if (route && route.enabled) {
      let schedule = route.schedules.find((s: any) => s.id == ticket.scheduleId);
      if (schedule && schedule.status == "active") {
        if (new Date(schedule.startDate).getTime() >= new Date(day).getTime() && new Date(schedule.endDate).getTime() <= new Date(day).getTime()) {
          let t = schedule.departureTime.split(":");
          let time = parseInt(t[0]) * 60 + parseInt(t[1]) - 120;
          let now = new Date().getHours() * 60 + new Date().getMinutes();
          if (now > time) {
            throw new ErrorModel(400, "str_error_time");
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
    if (count == ticket.seats && newTotale == totale) {
      return true;
    }

    throw new ErrorModel(400, "str_error_check_price");
  }

  async updatePaymentInfo(type: string, other: any, numberOfTickets: string) {
    return await this.bookingDao.updatePaymentInfo(type, other, numberOfTickets);
  }
  async getBooking(numberOfTickets: string): Promise<booking> {
    return new booking(await this.bookingDao.getBooking(numberOfTickets));
  }
  async cancelBooking(numberOfTickets: string) {
    let success = await this.bookingDao.cancelBooking(numberOfTickets);
    if (success) {
      //manda mail annullato biglietto
    }
    return success;
  }

  async refundBooking(numberOfTickets: string) {
    let success = await this.bookingDao.refundBooking(numberOfTickets);
    if (success) {
      //manda mail rimborsato biglietto
    }
    return success;
  }
  async confirmBooking(numberOfTickets: string) {
    let success = await this.bookingDao.confirmBooking(numberOfTickets);
    if (success) {
      //manda mail confermato biglietto
    }

    return success;
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
    // if (booking) {
    //   const stripeServices = new StripeServices();
    //   for (let i = 0; i < booking.length; i++) {
    //     switch (booking.type) {
    //       case "stripe":
    //         await stripeServices.deletePaymentSession(booking.other.id);
    //         break;
    //     }
    //   }
    // }
  }
}

export default BookingsServices;
