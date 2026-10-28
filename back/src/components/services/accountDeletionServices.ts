import { Db } from "mongodb";
import { logger } from "../../index";
import { role } from "../../enum/role";
import ErrorModel from "../../model/errorModel";
import UsersDao from "../dao/usersDao";
import BookingsDao from "../dao/bookingsDao";
import GoogleSessionsDao from "../dao/googleSessionsDao";
import BookingsServices from "./bookingServices";
import PaymentServices from "./paymentServices";
import MfaServices from "./mfaServices";
import MailSenderServices from "./mailSender";

/**
 * Cancellazione dell'account richiesta dall'utente stesso (GDPR art. 17).
 *
 * Immediata e irreversibile. Le prenotazioni restano per la contabilita' ma
 * anonimizzate; tutto il resto (utente, fattori MFA, customer Stripe con le
 * carte salvate) viene eliminato. Il codice di conferma e' verificato dalla rotta.
 */
export default class AccountDeletionServices {
  private usersDao: UsersDao;
  private bookingsDao: BookingsDao;
  private db: Db;

  constructor(db: Db) {
    this.db = db;
    this.usersDao = new UsersDao(db);
    this.bookingsDao = new BookingsDao(db);
  }

  /** Errore se l'account non puo' essere cancellato dall'utente. */
  async checkCanDelete(userId: string): Promise<any> {
    const user = await this.usersDao.getUserById(userId);
    if (!user) throw new ErrorModel(404, "Utente non trovato");
    // staff e admin li rimuove un amministratore: niente piattaforma senza admin
    if (Number(user.role) < role.USER) throw new ErrorModel(403, "str_account_delete_staff");
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
    if ((await this.bookingsDao.countUpcomingConfirmed(userId, today)) > 0) {
      throw new ErrorModel(409, "str_account_delete_active_tickets");
    }
    return user;
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.checkCanDelete(userId);

    // come al logout: le prenotazioni in attesa di pagamento si annullano
    const bookingsServices = new BookingsServices(this.db);
    for (const booking of await bookingsServices.removePendingBooking(userId)) {
      await bookingsServices.deleteBooking(booking.numberOfTickets, userId);
    }

    // prima Stripe: se fallisce l'utente esiste ancora e puo' riprovare
    await new PaymentServices(this.db).deleteCustomer(userId);
    await this.bookingsDao.anonymizeUserBookings(userId);
    await new MfaServices(this.db).deleteAll(userId);
    await new GoogleSessionsDao(this.db).deleteGoogleSessionByEmail(user.email);
    await this.usersDao.deleteUserById(userId);
    logger.info(`Account ${userId} eliminato dall'utente`);

    const it = user.options?.lng !== "en";
    try {
      await new MailSenderServices(this.db).sendMfaCode(
        user.email,
        it ? "Account eliminato" : "Account deleted",
        it
          ? "Il tuo account è stato eliminato insieme ai dati personali e alle carte salvate. Le prenotazioni passate sono conservate in forma anonima per obblighi contabili."
          : "Your account has been deleted together with your personal data and saved cards. Past bookings are kept in anonymous form for accounting purposes.",
      );
    } catch (error: any) {
      logger.error(`Email di conferma cancellazione account non inviata: ${error?.message || error}`);
    }
  }
}
