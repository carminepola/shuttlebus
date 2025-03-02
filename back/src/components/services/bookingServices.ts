import { Db } from "mongodb";
import BookingDao from "../dao/bookingsDao";

class BookingsServices {
  private bookingDao: BookingDao;

  constructor(db: Db) {
    this.bookingDao = new BookingDao(db);
  }

  async findAvailableRoutes(travelDate: string, fromStopId: string, toStopId: string, posti: number = 1, bagagli: number = 0) {
    return await this.bookingDao.findAvailableRoutes(travelDate, fromStopId, toStopId, posti, bagagli);
  }
}

export default BookingsServices;
