import { Db } from 'mongodb';

import LngDao from '../dao/lngDao';
import LngModel from '../../model/lngModel';

class TicketTypeServices {
  private lngDao: LngDao;

  constructor(db: Db) {
    this.lngDao = new LngDao(db);
  }

  async create(obj: any) {
    let model = new LngModel(obj);
    return this.lngDao.create(model);
  }

  async update(obj: any) {
    let model = new LngModel(obj);
    return this.lngDao.update(model);
  }

  async getAll() {
    return this.lngDao.getAll();
  }

  async delete(id: string) {
    return this.lngDao.delete(id);
  }
}

export default TicketTypeServices;
