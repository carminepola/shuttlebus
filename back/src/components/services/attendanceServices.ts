import { Db } from "mongodb";
import AttendanceDao from "../dao/attendanceDao";
import attendanceModel from "../../model/attendanceModel";

class AttendanceServices {
  private attendanceDao: AttendanceDao;

  constructor(db: Db) {
    this.attendanceDao = new AttendanceDao(db);
  }

  async getByMonth(year: number, month: number) {
    return await this.attendanceDao.getByMonth(year, month);
  }

  async create(obj: Partial<attendanceModel>) {
    let model = new attendanceModel(obj);
    return await this.attendanceDao.create(model);
  }

  async update(obj: Partial<attendanceModel>) {
    let model = new attendanceModel(obj);
    return await this.attendanceDao.update(model);
  }

  async delete(id: string) {
    return await this.attendanceDao.delete(id);
  }
}

export default AttendanceServices;
