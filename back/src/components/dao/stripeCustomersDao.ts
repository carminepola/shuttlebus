import { Db } from "mongodb";

/**
 * Associazione utente -> Customer Stripe, usata per riproporre al checkout le
 * carte che l'utente ha scelto di salvare.
 *
 * Collection SEPARATA da "users": il documento utente finisce nel JWT di
 * sessione. Chiave = _id dell'utente (non l'email), come per user_mfa.
 */
export interface StripeCustomer {
  userId: string;
  customerId: string;
  createdAt: number;
}

export default class StripeCustomersDao {
  db: Db;
  schema: string = "stripe_customers";
  constructor(db: Db) {
    this.db = db;
  }

  async getByUserId(userId: string): Promise<StripeCustomer | null> {
    return this.db.collection<StripeCustomer>(this.schema).findOne({ userId: String(userId) }, { projection: { _id: 0 } });
  }

  /**
   * Registra il customer solo se l'utente non ne ha gia' uno e restituisce
   * quello effettivamente salvato: con due checkout concorrenti vince il primo.
   */
  async insertIfMissing(userId: string, customerId: string): Promise<string> {
    const collection = this.db.collection<StripeCustomer>(this.schema);
    await collection.createIndex({ userId: 1 }, { unique: true, name: "uniq_user_id" });
    try {
      await collection.updateOne(
        { userId: String(userId) },
        { $setOnInsert: { userId: String(userId), customerId, createdAt: Date.now() } },
        { upsert: true },
      );
    } catch (error: any) {
      // upsert concorrente sullo stesso userId: l'altro documento e' gia' quello buono
      if (error?.code !== 11000) throw error;
    }
    const saved = await this.getByUserId(userId);
    return saved!.customerId;
  }

  async replace(userId: string, customerId: string): Promise<void> {
    await this.db
      .collection<StripeCustomer>(this.schema)
      .updateOne({ userId: String(userId) }, { $set: { customerId, createdAt: Date.now() } }, { upsert: true });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.collection<StripeCustomer>(this.schema).deleteOne({ userId: String(userId) });
  }
}
