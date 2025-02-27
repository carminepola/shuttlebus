import { Db } from "mongodb";

import StopsDao from "../dao/stopsDao";
import StopModel from "../../model/stopsModel";
class StopServices {
  private stopsDao: StopsDao;

  constructor(db: Db) {
    this.stopsDao = new StopsDao(db);
  }

  async createStop(obj: any) {
    const stopData: StopModel = new StopModel(obj);
    return await this.stopsDao.createStop(stopData);
  }

  async getAllStops() {
    return await this.stopsDao.getAllStops();
  }

  async getAllActiveStops() {
    return await this.stopsDao.getAllActiveStops();
  }

  async getStop(id: string) {
    return await this.stopsDao.getStops(id);
  }

  async updateStop(obj: any) {
    const updateData: StopModel = new StopModel(obj);
    return await this.stopsDao.updateStop(updateData);
  }

  async deleteStop(id: string) {
    return await this.stopsDao.deleteStop(id);
  }
}

export default StopServices;
