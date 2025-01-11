import { Db } from "mongodb";
import FailToBanDao from "../dao/failToBan";
export default class FailToBanServices {
  private readonly failToBanDao: FailToBanDao;

  constructor(db: Db) {
    this.failToBanDao = new FailToBanDao(db);
  }

  async isFail(ip: string) {
    return this.failToBanDao.isFail(ip);
  }

  async deleteIp(ip: string) {
    return this.failToBanDao.deleteIp(ip);
  }

  async insertIp(ip: string) {
    return this.failToBanDao.insertIp(ip);
  }
}
