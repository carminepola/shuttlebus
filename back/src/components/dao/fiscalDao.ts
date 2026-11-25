import { ClientSession, Db } from "mongodb";
import { FiscalDoc, FiscalSettings } from "../../utils/fiscal";

/** Impostazioni fiscali (collection fiscalSettings), contatori annuali e letture per il report. */
export default class FiscalDao {
  private db: Db;
  private static countersReady = false;

  constructor(db: Db) {
    this.db = db;
  }

  async getSettings() {
    return this.db.collection("fiscalSettings").findOne({ id: "default" }, { projection: { _id: 0 } });
  }

  async updateSettings(settings: FiscalSettings) {
    const result = await this.db.collection("fiscalSettings").updateOne({ id: "default" }, { $set: { ...settings, updatedAt: Date.now() } }, { upsert: true });
    return result.acknowledged;
  }

  /** La collection dei contatori deve esistere prima della transazione (niente createCollection implicito dentro). */
  async ensureCounters() {
    if (FiscalDao.countersReady) return;
    try {
      await this.db.createCollection("fiscalCounters");
    } catch {
      // gia' esistente
    }
    FiscalDao.countersReady = true;
  }

  async getBooking(numberOfTickets: string, session: ClientSession) {
    return this.db.collection("bookings").findOne({ numberOfTickets }, { session });
  }

  /** Prossimo numero progressivo dell'anno (dentro la transazione di emissione). */
  async nextNumber(year: number, session: ClientSession): Promise<number> {
    const doc = await this.db
      .collection("fiscalCounters")
      .findOneAndUpdate({ _id: `tickets_${year}` as any }, { $inc: { seq: 1 }, $set: { updatedAt: Date.now() } }, { upsert: true, returnDocument: "after", session });
    return Number(doc?.seq);
  }

  async setFiscal(numberOfTickets: string, fiscal: FiscalDoc, session: ClientSession) {
    const result = await this.db.collection("bookings").updateOne({ numberOfTickets, "fiscal.code": { $exists: false } }, { $set: { fiscal } }, { session });
    return result.modifiedCount > 0;
  }

  /** Biglietti fiscali emessi fino a `to` che hanno vendite o possibili rimborsi nel periodo. */
  async findForReport(from: string, to: string) {
    return this.db
      .collection("bookings")
      .find({
        "fiscal.code": { $exists: true },
        "fiscal.date": { $lte: to },
        $or: [{ "fiscal.date": { $gte: from } }, { status: "refunded" }, { "refunds.0": { $exists: true } }],
      })
      .project({ numberOfTickets: 1, status: 1, date: 1, name: 1, from: 1, to: 1, "user.name": 1, fiscal: 1, refunds: 1, refundedAt: 1, updatedAt: 1 })
      .toArray();
  }

  /** Biglietti pagati senza numero fiscale nel periodo (emissione fallita: da controllare). */
  async countPaidWithoutFiscal(sinceMs: number) {
    return this.db.collection("bookings").countDocuments({
      status: { $in: ["confirmed", "cancelled", "refunded"] },
      payment_status: { $in: ["paid", "refunded"] },
      total: { $gt: 0 },
      createdAt: { $gte: sinceMs },
      "fiscal.code": { $exists: false },
    });
  }

  /** Primo biglietto fiscale emesso (da quando la numerazione e' attiva). */
  async firstIssuedAt(): Promise<number | null> {
    const first = await this.db.collection("bookings").find({ "fiscal.code": { $exists: true } }).project({ "fiscal.issuedAt": 1 }).sort({ "fiscal.issuedAt": 1 }).limit(1).toArray();
    return first[0]?.fiscal?.issuedAt ?? null;
  }
}
