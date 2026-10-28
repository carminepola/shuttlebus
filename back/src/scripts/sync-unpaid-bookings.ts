import { MongoClient } from "mongodb";
import Stripe from "stripe";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) {
  console.error("CONNECTION_STRING mancante nel file .env");
  process.exit(1);
}
let stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      console.error("STRIPE_SECRET_KEY mancante nel file .env");
      process.exit(1);
    }
    stripe = new Stripe(key, { apiVersion: "2026-09-30.endive" });
  }
  return stripe!;
}

/**
 * One-off script di riallineamento booking <-> Stripe (pentest item webhook sync).
 *
 * Cerca le prenotazioni stripe "desyncate":
 *  1) status confirmed e payment_status NON paid, oppure paymentIntentId assente
 * per ognuna recupera da Stripe (OrderByPaymentIntent / paymentIntents search via
 * metadata.booking_id oppure la sessione in other.id) e ripristina
 * paymentIntentId / payment_status / status.
 *
 * Idempotente: puo' essere rieseguito senza effetti collaterali.
 *
 * Uso:  npm run sync:unpaidBookings  (o: ts-node src/scripts/sync-unpaid-bookings.ts [--dry-run])
 */
async function run(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const stripeClient = getStripe();
  const client = new MongoClient(connectionString!);
  await client.connect();
  const db = client.db();
  const col = db.collection("bookings");

    const query: any = {
    status: { $in: ["confirmed", "pending"] },
    paymentMethod: "stripe",
    $or: [
      { payment_status: { $ne: "paid" } },
      { paymentIntentId: { $in: [null, ""] } },
      { paymentIntentId: { $exists: false } },
    ],
  };

  const bookings = await col.find(query).toArray();
  console.log(`Trovate ${bookings.length} prenotazioni potenzialmente desyncate`);

  let fixed = 0;
  let notPaid = 0;
  let failed = 0;

  for (const book of bookings) {
    const bookingId: string = book.numberOfTickets;
    let paymentIntentId: string | null = book.paymentIntentId || null;

    try {
      // 1) Via paymentIntentId naturale
      if (!paymentIntentId) {
        // 2) Via sessione salvata nel booking (other.id)
        const sessionId = book.other?.id;
        if (sessionId && typeof sessionId === "string" && sessionId.startsWith("cs_")) {
          try {
            const session = await stripeClient.checkout.sessions.retrieve(sessionId);
            if (session.payment_intent) {
              paymentIntentId = session.payment_intent as string;
            }
            if (session.payment_status === "paid" && session.payment_intent) {
              paymentIntentId = session.payment_intent as string;
            }
          } catch {
            /* session non piu' disponibile */
          }
        }
      }

      // 3) Via Stripe search su metadata.booking_id (copre sessioni/personalizzazioni mancanti)
      if (!paymentIntentId) {
        try {
          const searched = await stripeClient.paymentIntents.search({
            query: `metadata['booking_id']:'${bookingId}'`,
            limit: 1,
          });
          paymentIntentId = searched.data[0]?.id || null;
        } catch (err) {
          console.warn(`Search non disponibile per ${bookingId}: ${err instanceof Error ? err.message : err}`);
        }
      }

      if (!paymentIntentId) {
        console.log(`- ${bookingId}: nessun PaymentIntent trovato su Stripe, record non toccato`);
        notPaid++;
        continue;
      }

      const pi = await stripeClient.paymentIntents.retrieve(paymentIntentId);
      const paid = pi.status === "succeeded" || pi.status === "requires_capture";

      if (dryRun) {
        console.log(`[DRY] ${bookingId}: pi=${paymentIntentId} status=${pi.status} DB(${book.status}/${book.payment_status}) -> ${paid ? "paid/sync" : "no"}`);
        if (paid) {
          fixed++;
        } else {
          notPaid++;
        }
        continue;
      }

      const update: any = { $set: { updatedAt: new Date().getTime() } };
      update.$set.paymentIntentId = paymentIntentId;
      if (paid) {
        update.$set.payment_status = "paid";
        update.$set.status = "confirmed";
      }
      const res = await col.updateOne({ numberOfTickets: bookingId }, update);
      if (res.matchedCount > 0) {
        console.log(`✔ ${bookingId}: sincronizzato con pi=${paymentIntentId} (status lettura Stripe: ${pi.status})`);
        fixed++;
      }
    } catch (err) {
      console.error(`✗ ${bookingId}: errore durante la sincronizzazione`, err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log(`Completato: sync=${fixed} noPaymentFound=${notPaid} falliti=${failed}`);
  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
