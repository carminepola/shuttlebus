import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) {
  console.error("CONNECTION_STRING mancante nel file .env");
  process.exit(1);
}

/**
 * Migrazione one-off per V8: invalida i biglietti emessi per pagamenti non confermati.
 *
 * 1) Backfill di 'payment_status' su tutte le prenotazioni esistenti:
 *    - status 'confirmed' con prova di pagamento (paymentIntentId o sessione stripe
 *      'other.id' presente) oppure pagamento contanti -> 'paid'
 *    - status 'refunded' -> 'refunded'
 *    - ogni altro caso -> 'unpaid' (o 'failed' per expired/cancelled)
 *
 * 2) Invalidazione: le prenotazioni 'confirmed' SENZA prova di pagamento
 *    (nessun paymentIntentId, nessuna sessione stripe, non contanti)
 *    tornano 'expired' con payment_status 'failed' e cancelMotivation
 *    'invalidated_unpaid_migration'. Questi biglietti non sono piu'
 *    scaricabili/scansionabili (gate server-side su payment_status 'paid').
 *
 * 3) crea l'indice unique su webhook_events.event_id (idempotenza webhook Stripe).
 *
 * Idempotente: puo' essere rieseguito senza effetti collaterali.
 */
async function run() {
  const client = new MongoClient(connectionString!);
  await client.connect();
  const db = client.db();
  const col = db.collection("bookings");

  // --- 1) Backfill payment_status ---
  const backfillPaid = await col.updateMany(
    {
      payment_status: null,
      status: "confirmed",
      $or: [{ paymentIntentId: { $nin: ["", null] } }, { "other.id": { $exists: true, $ne: "" } }, { paymentMethod: "cash" }],
    },
    { $set: { payment_status: "paid" } },
  );
  console.log(`- payment_status=paid impostato su ${backfillPaid.modifiedCount} prenotazioni confermate con prova di pagamento`);

  const backfillRefunded = await col.updateMany(
    { payment_status: null, status: { $in: ["refunded"] } },
    { $set: { payment_status: "refunded" } },
  );
  console.log(`- payment_status=refunded impostato su ${backfillRefunded.modifiedCount} prenotazioni rimborsate`);

  const backfillFailed = await col.updateMany(
    { payment_status: null, status: { $in: ["expired", "cancelled"] } },
    { $set: { payment_status: "failed" } },
  );
  console.log(`- payment_status=failed impostato su ${backfillFailed.modifiedCount} prenotazioni scadute/annullate`);

  const backfillUnpaid = await col.updateMany(
    { payment_status: null },
    { $set: { payment_status: "unpaid" } },
  );
  console.log(`- payment_status=unpaid impostato su ${backfillUnpaid.modifiedCount} prenotazioni rimanenti`);

  // --- 2) Invalidazione biglietti confermati senza pagamento ---
  const invalidated = await col.updateMany(
    {
      status: "confirmed",
      payment_status: { $ne: "paid" },
      paymentIntentId: { $in: ["", null] },
      "other.id": null,
      paymentMethod: { $ne: "cash" },
    },
    {
      $set: {
        status: "expired",
        payment_status: "failed",
        cancelMotivation: "invalidated_unpaid_migration",
        updatedAt: new Date().getTime(),
      },
    },
  );
  console.log(`- Invalidati ${invalidated.modifiedCount} biglietti confermati senza pagamento confermato`);

  // --- 3) Indice unique webhook_events.event_id ---
  try {
    await db.collection("webhook_events").createIndex({ event_id: 1 }, { unique: true, name: "uniq_stripe_event_id" });
    console.log("Indice unico su 'webhook_events.event_id' creato correttamente.");
  } catch (error: any) {
    console.error("Creazione indice webhook_events fallita:", error?.message || error);
  }

  const summary = await col.aggregate([
    { $group: { _id: { status: "$status", payment_status: "$payment_status" }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]).toArray();
  console.log("Riepilogo finale:", JSON.stringify(summary, null, 2));

  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
