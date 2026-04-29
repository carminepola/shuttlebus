import { Db } from 'mongodb';
import LicensePlateDao from '../dao/licensePlateDao';
import licensePlateModel from '../../model/licensePlateModel';

class LicensePlateServices {
  private licensePlateDao: LicensePlateDao;

  constructor(db: Db) {
    this.licensePlateDao = new LicensePlateDao(db);
  }

  async create(obj: Partial<licensePlateModel>) {
    let model = new licensePlateModel(obj);
    return this.licensePlateDao.create(model);
  }

  async getAll() {
    return this.licensePlateDao.getAll();
  }

  async getById(id: string) {
    return this.licensePlateDao.getById(id);
  }

  async getByLicensePlate(licensePlate: string) {
    return this.licensePlateDao.getByLicensePlate(licensePlate);
  }

  async getEnabled() {
    return this.licensePlateDao.getEnabled();
  }

  async getImeiByLicensePlate(licensePlate: string): Promise<string | null> {
    const licensePlateData = await this.licensePlateDao.getByLicensePlate(licensePlate);
    if (licensePlateData && licensePlateData.enabled) {
      return licensePlateData.imei;
    }
    return null;
  }

  async update(obj: Partial<licensePlateModel>) {
    let model = new licensePlateModel(obj);
    return this.licensePlateDao.update(model);
  }

  async delete(id: string) {
    return this.licensePlateDao.delete(id);
  }
}

export default LicensePlateServices;
