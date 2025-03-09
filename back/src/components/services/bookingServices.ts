import { Db } from "mongodb";
import BookingDao from "../dao/bookingsDao";
import booking from "../../model/bookFromSiteModel";

class BookingsServices {
  private bookingDao: BookingDao;

  constructor(db: Db) {
    this.bookingDao = new BookingDao(db);
  }

  async findAvailableRoutes(travelDate: string, fromStopId: string, toStopId: string, posti: number = 1, bagagli: number = 0) {
    //this.removeExpiredPendingBookings();
    return await this.bookingDao.findAvailableRoutes(travelDate, fromStopId, toStopId, posti, bagagli);
  }

  async insertBooking(ticket: any, userId: string) {
    ticket.userId = userId;
    let book: booking = new booking(ticket);
    return await this.bookingDao.insertBooking(book);
  }
  async removeExpiredPendingBookings() {
    return await this.bookingDao.removeExpiredPendingBookings();
  }
}

export default BookingsServices;
