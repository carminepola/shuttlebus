import { Db } from "mongodb";
import { client, logger } from "../../index";
import FiscalDao from "../dao/fiscalDao";
import { buildFiscalDoc, buildFiscalReport, FiscalDoc, FiscalSettings, missingFiscalFields, normalizeFiscalSettings } from "../../utils/fiscal";

/**
 * Biglietti come documento fiscale: numerazione progressiva annuale e dati
 * dell'emittente assegnati al pagamento, report dei corrispettivi per il commercialista.
 */
class FiscalServices {
  private fiscalDao: FiscalDao;

  constructor(db: Db) {
    this.fiscalDao = new FiscalDao(db);
  }

  async getSettings(): Promise<FiscalSettings> {
    return normalizeFiscalSettings(await this.fiscalDao.getSettings());
  }

  async updateSettings(patch: Partial<FiscalSettings>) {
    const current = await this.getSettings();
    return this.fiscalDao.updateSettings(normalizeFiscalSettings({ ...current, ...patch }));
  }

  /**
   * Emette il documento fiscale del biglietto pagato (idempotente): numero
   * progressivo dell'anno + dati dell'emittente e scorporo IVA. Tutto in una
   * transazione: due chiamate concorrenti (webhook ripetuti) non consumano due
   * numeri e la sequenza resta senza buchi. Biglietti non pagati o a importo 0
   * (omaggi) non ricevono numero. Non lancia mai: il pagamento resta valido.
   */
  async issue(numberOfTickets: string): Promise<FiscalDoc | null> {
    try {
      const settings = await this.getSettings();
      const missing = missingFiscalFields(settings);
      if (missing.length > 0) {
        logger.error(`Dati fiscali incompleti (${missing.join(", ")}): il biglietto ${numberOfTickets} viene emesso senza questi dati. Completare in Admin -> Commercialista`);
      }
      await this.fiscalDao.ensureCounters();
      const session = client.startSession();
      let result: FiscalDoc | null = null;
      try {
        await session.withTransaction(async () => {
          result = null;
          const book: any = await this.fiscalDao.getBooking(numberOfTickets, session);
          if (!book) return;
          if (book.fiscal?.code) {
            result = book.fiscal;
            return;
          }
          if (book.status !== "confirmed" || book.payment_status !== "paid" || !(Number(book.total) > 0)) return;
          const issuedAt = new Date();
          const number = await this.fiscalDao.nextNumber(issuedAt.getFullYear(), session);
          const fiscal = buildFiscalDoc(book, settings, number, issuedAt);
          if (await this.fiscalDao.setFiscal(numberOfTickets, fiscal, session)) result = fiscal;
        });
      } finally {
        await session.endSession();
      }
      const issued = result as FiscalDoc | null;
      if (issued) logger.info(`Documento fiscale ${issued.code} per il biglietto ${numberOfTickets}`);
      return issued;
    } catch (error) {
      logger.error(`Emissione del documento fiscale fallita per il biglietto ${numberOfTickets}`, error);
      return null;
    }
  }

  async report(from: string, to: string) {
    const [books, settings, firstIssuedAt] = await Promise.all([this.fiscalDao.findForReport(from, to), this.getSettings(), this.fiscalDao.firstIssuedAt()]);
    const report = buildFiscalReport(books, from, to);
    // biglietti pagati dopo l'attivazione rimasti senza numero (errore di emissione)
    const missingFiscal = firstIssuedAt ? await this.fiscalDao.countPaidWithoutFiscal(firstIssuedAt) : 0;
    return { ...report, settings, missingSettings: missingFiscalFields(settings), firstIssuedAt, missingFiscal };
  }
}

export default FiscalServices;
