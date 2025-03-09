import { Db } from "mongodb";
import BookingDao from "../dao/bookingsDao";
import booking from "../../model/bookFromSiteModel";
import UserServices from "./userServices";
import { client } from "../../index";
import { ClientSession } from "mongodb";
class BookingsServices {
  private bookingDao: BookingDao;
  private userServices: UserServices;

  constructor(db: Db) {
    this.bookingDao = new BookingDao(db);
    this.userServices = new UserServices(db);
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
    session.startTransaction();
    try {
      await this.removeExpiredPendingBookings();

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
        throw new Error("Not enough seats available");
      }
      if (book.luggage > numeroPosti.availableLuggage) {
        throw new Error("Not enough seats available");
      }

      let res = await this.bookingDao.insertBooking(book, session);

      await session.commitTransaction();
      await session.endSession();
      return res;
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      throw error;
    }
  }
  async removeExpiredPendingBookings() {
    return await this.bookingDao.removeExpiredPendingBookings();
  }
  async readBookingConfirmed(date: string, routeId: string, scheduleId: string) {
    return await this.bookingDao.readBookingConfirmed(date, routeId, scheduleId);
  }
  async getBookingForUser(userId: string) {
    return await this.bookingDao.getBookingForUser(userId);
  }
}

export default BookingsServices;
