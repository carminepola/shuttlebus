import { Db } from 'mongodb';
import DepotSettingsDao from '../dao/depotSettingsDao';
import depotSettingsModel from '../../model/depotSettingsModel';

class DepotSettingsServices {
  private depotSettingsDao: DepotSettingsDao;

  constructor(db: Db) {
    this.depotSettingsDao = new DepotSettingsDao(db);
  }

  async get() {
    return this.depotSettingsDao.get();
  }

  async update(obj: Partial<depotSettingsModel>) {
    if (!obj || Object.keys(obj).length === 0) {
      throw new Error('Invalid input: settings object is required');
    }
    let model = new depotSettingsModel(obj);
    return this.depotSettingsDao.update(model);
  }
}

export default DepotSettingsServices;
