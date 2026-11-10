import { Db } from "mongodb";
import BookingSettingsDao from "../dao/bookingSettingsDao";
import { BookingSettings, normalizeBookingSettings } from "../../utils/bookingSettings";

/** Impostazioni delle prenotazioni: chiusura vendite e termine per i rimborsi. */
class BookingSettingsServices {
  private bookingSettingsDao: BookingSettingsDao;

  constructor(db: Db) {
    this.bookingSettingsDao = new BookingSettingsDao(db);
  }

  /** Sempre complete: documento assente o campi mancanti -> default. */
  async get(): Promise<BookingSettings> {
    return normalizeBookingSettings(await this.bookingSettingsDao.get());
  }

  /** Aggiorna solo i campi indicati (gia' validati dalla rotta). */
  async update(obj: Partial<BookingSettings>) {
    const current = await this.get();
    return await this.bookingSettingsDao.update(normalizeBookingSettings({ ...current, ...obj }));
  }
}

export default BookingSettingsServices;
