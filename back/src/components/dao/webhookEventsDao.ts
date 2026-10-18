import { Db } from "mongodb";

/**
 * DAO per l'idempotenza dei webhook Stripe.
 * Registra gli event_id gia' processati con indice unique su event_id:
 * una doppia consegna dello stesso evento non riprocessa la business logic.
 */
export default class WebhookEventsDao {
  private db: Db;
  private collectionName = "webhook_events";
  private indexReady = false;

  constructor(db: Db) {
    this.db = db;
  }

  private async ensureIndex() {
    if (this.indexReady) return;
    await this.db.collection(this.collectionName).createIndex({ event_id: 1 }, { unique: true, name: "uniq_stripe_event_id" });
    this.indexReady = true;
  }

  /**
   * Tenta di "claimare" l'evento inserendolo con indice unique.
   * Ritorna false se l'evento era gia' stato processato (duplicate key).
   */
  async claimEvent(eventId: string, eventType: string): Promise<boolean> {
    await this.ensureIndex();
    try {
      await this.db.collection(this.collectionName).insertOne({
        event_id: eventId,
        type: eventType,
        processedAt: new Date().getTime(),
      });
      return true;
    } catch (error: any) {
      if (error?.code === 11000 || error?.message?.includes("E11000") || error?.message?.includes("duplicate key")) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Rilascia il claim in caso di errore di elaborazione,
   * cosi' un retry di Stripe puo' riprocessare l'evento.
   */
  async releaseEvent(eventId: string): Promise<void> {
    await this.db.collection(this.collectionName).deleteOne({ event_id: eventId });
  }
}
