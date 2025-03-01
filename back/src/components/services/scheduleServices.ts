import { Db, ClientSession } from "mongodb";
import { Schedule, ScheduleStop, PurchasedTicket, Booking, Stop } from "../../model/routeModel";
import ScheduleDAO from "../dao/scheduleDao";
import Mongo from "../../infrastructure/mongo";
import { cli } from "winston/lib/winston/config";
export default class ScheduleServices {
  private scheduleDao: ScheduleDAO;

  constructor(db: Db) {
    this.scheduleDao = new ScheduleDAO(db);
  }

  async createSchedule(schedule: Schedule) {
    return await this.scheduleDao.createSchedule(schedule);
  }

  async getScheduleById(scheduleId: string, session?: ClientSession) {
    return await this.scheduleDao.getScheduleById(scheduleId, session);
  }

  async getAvailability(scheduleId: string, fromStopId: string, toStopId: string, session?: ClientSession) {
    return await this.scheduleDao.getAvailability(scheduleId, fromStopId, toStopId, session);
  }

  async bookSeats(booking: Booking, session?: ClientSession) {
    return await this.scheduleDao.bookSeats(booking, session);
  }

  async confirmBooking(bookingId: string) {
    return await this.scheduleDao.confirmBooking(bookingId);
  }

  async refundBooking(bookingId: string) {
    return await this.scheduleDao.refundBooking(bookingId);
  }

  async cancelBooking(bookingId: string) {
    return await this.scheduleDao.cancelBooking(bookingId);
  }

  async expireOldBookings() {
    return await this.scheduleDao.expireOldBookings();
  }
}
