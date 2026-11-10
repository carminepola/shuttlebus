import { Db } from "mongodb";
import DepotSettingsDao from "../dao/depotSettingsDao";
import depotSettingsModel from "../../model/depotSettingsModel";
import { sanitizeCutoffMinutes } from "../../utils/bookingCutoff";

class DepotSettingsServices {
  private depotSettingsDao: DepotSettingsDao;

  constructor(db: Db) {
    this.depotSettingsDao = new DepotSettingsDao(db);
  }

  async get() {
    const settings: any = await this.depotSettingsDao.get();
    // documenti salvati prima del campo: valore di default
    return { ...settings, bookingCutoffMinutes: sanitizeCutoffMinutes(settings?.bookingCutoffMinutes ?? process.env.DEFAULT_BOOKING_CUTOFF_MINUTES) };
  }

  /** Minuti prima della partenza in cui si chiudono le vendite (documenti vecchi: default). */
  async getBookingCutoffMinutes(): Promise<number> {
    return (await this.get()).bookingCutoffMinutes;
  }

  async update(obj: Partial<depotSettingsModel>) {
    if (!obj || Object.keys(obj).length === 0) {
      throw new Error("Invalid input: settings object is required");
    }
    let model = new depotSettingsModel(obj);
    return await this.depotSettingsDao.update(model);
  }
}

export default DepotSettingsServices;
