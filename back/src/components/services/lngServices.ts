import { Db } from "mongodb";

import LngDao from "../dao/lngDao";
import LngModel from "../../model/lngModel";

class TicketTypeServices {
  private lngDao: LngDao;

  constructor(db: Db) {
    this.lngDao = new LngDao(db);
  }

  async create(obj: any) {
    let model = new LngModel(obj);
    return await this.lngDao.createTicketType(model);
  }

  async getAll() {
    return await this.lngDao.getAll();
  }
  async delete(id: string) {
    return await this.lngDao.delete(id);
  }
}

export default TicketTypeServices;
