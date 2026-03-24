import { Db } from "mongodb";
import LicensePlateDao from "../dao/licensePlateDao";
import licensePlateModel from "../../model/licensePlateModel";

class LicensePlateServices {
  private licensePlateDao: LicensePlateDao;

  constructor(db: Db) {
    this.licensePlateDao = new LicensePlateDao(db);
  }

  async create(obj: Partial<licensePlateModel>) {
    let model = new licensePlateModel(obj);
    return await this.licensePlateDao.create(model);
  }

  async getAll() {
    return await this.licensePlateDao.getAll();
  }

  async getById(id: string) {
    return await this.licensePlateDao.getById(id);
  }

  async getByLicensePlate(licensePlate: string) {
    return await this.licensePlateDao.getByLicensePlate(licensePlate);
  }

  async getEnabled() {
    return await this.licensePlateDao.getEnabled();
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
    return await this.licensePlateDao.update(model);
  }

  async delete(id: string) {
    return await this.licensePlateDao.delete(id);
  }
}

export default LicensePlateServices;
