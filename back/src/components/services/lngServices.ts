import { Db } from "mongodb";

import LngDao from "../dao/lngDao";
import LngModel from "../../model/lngModel";
import { invalidateTranslations } from "../../i18n/translate";

class LngServices {
  private lngDao: LngDao;

  constructor(db: Db) {
    this.lngDao = new LngDao(db);
  }

  async create(obj: any) {
    let model = new LngModel(obj);
    const id = await this.lngDao.create(model);
    invalidateTranslations();
    return id;
  }

  async update(obj: any) {
    let model = new LngModel(obj);
    const id = await this.lngDao.update(model);
    invalidateTranslations();
    return id;
  }

  async getAll() {
    return await this.lngDao.getAll();
  }
  async delete(id: string) {
    const res = await this.lngDao.delete(id);
    invalidateTranslations();
    return res;
  }
}

export default LngServices;
