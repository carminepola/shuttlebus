import { Db } from "mongodb";
import FailToBanDao from "../dao/failToBan";
export default class FailToBanServices {
  private readonly failToBanDao: FailToBanDao;

  constructor(db: Db) {
    this.failToBanDao = new FailToBanDao(db);
  }

  async isFail(key: string) {
    return this.failToBanDao.isFail(key);
  }

  async isRateLimited(key: string) {
    return this.failToBanDao.isRateLimited(key);
  }

  async getFailState(key: string) {
    return this.failToBanDao.getFailState(key);
  }

  async deleteIp(key: string) {
    return this.failToBanDao.deleteIp(key);
  }

  async insertIp(key: string) {
    return this.failToBanDao.insertIp(key);
  }
}
