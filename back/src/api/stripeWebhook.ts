import express from "express";
import Stripe from "stripe";
import { db, logger } from "../index";
import StripeInstance from "../stripe";
import BookingsServices from "../components/services/bookingServices";
import WebhookEventsDao from "../components/dao/webhookEventsDao";
require("dotenv").config();

/**
 * Router del webhook Stripe.
 * DEVE essere montato PRIMA dei body parser globali (express.json/urlencoded):
 * la verifica della firma richiede il body RAW della richiesta.
 */
const router = express.Router();

const stripe = StripeInstance.getInstance();

router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET;

  // Verifica firma OBBLIGATORIA su ogni request: secret o firma assente -> 400, nessun processing
  if (!webhookSecret) {
    logger.error("Webhook Stripe rifiutato: STRIPE_WEBHOOK_SECRET non configurato");
    return res.status(400).send("Webhook non configurato");
  }
  if (!signature || typeof signature !== "string") {
    logger.warn("Webhook Stripe rifiutato: header Stripe-Signature assente");
    return res.status(400).send("Firma mancante");
  }

  // Se la route è raggiunta DOPO express.json (es. /api/stripe/webhook), il body
  // è stato già parsed: usiamo la copia RAW conservata da app.ts (verify) per la firma
  const rawBody = Buffer.isBuffer(req.body) ? req.body : (req as any).rawBody;
  if (!Buffer.isBuffer(rawBody)) {
    logger.warn("Webhook Stripe rifiutato: body non ricevuto raw (verificare il mount prima di express.json)");
    return res.status(400).send("Body raw richiesto");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    logger.warn("Webhook Stripe rifiutato: firma non valida", { error: err instanceof Error ? err.message : err });
    return res.status(400).send("Firma non valida");
  }

  logger.info(`Webhook Stripe ricevuto: ${event.type} (${event.id})`);

  // Idempotenza: claim atomico sull'event_id, se gia' processato risponde 200 senza riprocessare
  const webhookEventsDao = new WebhookEventsDao(db);
  let claimed = false;
  try {
    claimed = await webhookEventsDao.claimEvent(event.id, event.type);
    if (!claimed) {
      logger.info(`Evento ${event.id} gia' processato, ignoro`);
      return res.json({ received: true });
    }

    const bookingServices = new BookingsServices(db);
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        if (!bookingId) {
          logger.warn(`checkout.session.completed senza metadata.booking_id (event ${event.id})`);
          break;
        }

        // Rileggi la sessione dall'API: il payment_status nel payload va confermato a valle
        let effectiveSession: Stripe.Checkout.Session = session;
        try {
          effectiveSession = await stripe.checkout.sessions.retrieve(session.id);
        } catch (err) {
          logger.warn(`Impossibile rileggere la sessione ${session.id}, uso il payload dell'evento`, err instanceof Error ? err.message : err);
        }
        const paymentIntentId = (effectiveSession.payment_intent as string | undefined) ?? null;

        // Persisti SEMPRE il collegamento booking <-> paymentIntent (anche se il pagamento non e' ancora paid)
        if (paymentIntentId) {
          await bookingServices.updatePaymentIntentId(bookingId, paymentIntentId);
        }

        // Con capture_method=manual la sessione completata arriva con
        // payment_status="unpaid" (fondi riservati, PI in requires_capture):
        // NON e' motivo di scarto. La conferma avviene SOLO sullo stato reale
        // del PaymentIntent (requires_capture -> capture nostra, oppure
        // succeeded), quindi una capture e' possibile SOLO dopo il gate
        // importo P-01.
        if (effectiveSession.payment_status === "no_payment_required") {
          logger.warn(`checkout.session.completed per ${bookingId} con payment_status=no_payment_required: nessun pagamento da confermare`);
          break;
        }

        // P-01 (price manipulation): confronto OBBLIGATORIO importo <-> booking.total.
        // Una sessione pagata ad un prezzo diverso dal total server-side non conferma
        // mai la prenotazione; con capture manuale l'importo scorretto NON viene catturato.
        const bookingRaw = await bookingServices.getBookingRaw(bookingId);
        if (!bookingRaw) {
          logger.warn(`checkout.session.completed per booking inesistente ${bookingId} (event ${event.id})`);
          break;
        }
        const expectedAmount = Math.round((bookingRaw.total ?? 0) * 100);
        if ((effectiveSession.amount_total ?? -1) !== expectedAmount) {
          logger.error(`Discordanza importo per la prenotazione ${bookingId}: session.amount_total=${effectiveSession.amount_total}, atteso=${expectedAmount} (booking.total=${bookingRaw.total}). Prenotazione invalidata, importo non catturato (event ${event.id})`);
          await bookingServices.expireTicketById(bookingId);
          await bookingServices.updatePaymentStatus(bookingId, "failed");
          break;
        }

        if (paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

          if (paymentIntent.status === "requires_capture") {
            const captured = await stripe.paymentIntents.capture(paymentIntentId);
            if (captured.status !== "succeeded") {
              await bookingServices.expireTicketById(bookingId);
              await bookingServices.updatePaymentStatus(bookingId, "failed");
              logger.error(`Cattura pagamento fallita per la prenotazione ${bookingId} (event ${event.id})`);
              throw new Error("str_payment_failed");
            }
            await bookingServices.confirmBooking(bookingId, session.id);
            await bookingServices.updatePaymentStatus(bookingId, "paid");
            logger.info(`Pagamento catturato con successo per la prenotazione ${bookingId}`);
          } else if (paymentIntent.status === "succeeded") {
            // Conferma se ancora pending; se gia' confermata con lo STESSO paymentIntent
            // non fare nulla (idempotenza), ne' annullare pagamenti gia' riusciti
            const alreadySynced = await bookingServices.isBookingSyncedWithPayment(bookingId, paymentIntentId);
            if (!alreadySynced) {
              await bookingServices.confirmBooking(bookingId, session.id);
            }
            await bookingServices.updatePaymentStatus(bookingId, "paid");
            logger.info(`Il pagamento per la prenotazione ${bookingId} e' gia' stato addebitato.`);
          } else {
            logger.warn(`Stato payment_intent inatteso ${paymentIntent.status} per la prenotazione ${bookingId}: nessuna conferma, nessuna mail`);
            break;
          }

          // Mail SOLO dopo conferma pagamento reale (idempotente)
          await bookingServices.notifyConfirmation(bookingId);
        } else {
          logger.warn(`checkout.session.completed per ${bookingId} senza payment_intent`);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const bookingId = paymentIntent.metadata?.booking_id;
        let book: any = await bookingServices.readByPaymentIntentId(paymentIntent.id);
        if (!book && bookingId) {
          book = await bookingServices.getBookingRaw(bookingId);
        }
        if (book?.numberOfTickets) {
          const ticketId = book.numberOfTickets;
          // P-01 (price manipulation): anche questo percorso conferma SOLO se
          // l'importo del payment intent corrisponde al booking.total server-side.
          const expectedAmount = Math.round((book.total ?? 0) * 100);
          if ((paymentIntent.amount ?? -1) !== expectedAmount) {
            logger.error(`Discordanza importo (payment_intent.succeeded) per la prenotazione ${ticketId}: pi.amount=${paymentIntent.amount}, atteso=${expectedAmount} (booking.total=${book.total}). Prenotazione NON confermata (event ${event.id})`);
            await bookingServices.expireTicketById(ticketId);
            await bookingServices.updatePaymentStatus(ticketId, "failed");
            break;
          }
          // Persisti il collegamento + stato pagamento anche se checkout.session.completed non e' mai arrivato
          if (book.paymentIntentId !== paymentIntent.id) {
            await bookingServices.updatePaymentIntentId(ticketId, paymentIntent.id);
          }
          if (book.status === "pending") {
            await bookingServices.confirmBooking(ticketId);
            logger.info(`payment_intent.succeeded: confermata la prenotazione ${ticketId} (checkout.session.completed mancante)`);
          }
          await bookingServices.updatePaymentStatus(ticketId, "paid");
          logger.info(`payment_intent.succeeded: payment_status=paid per la prenotazione ${ticketId}`);
          // Mail SOLO dopo conferma pagamento reale (idempotente: claim su confirmationSentAt)
          await bookingServices.notifyConfirmation(ticketId);
        } else {
          logger.warn(`payment_intent.succeeded per ${paymentIntent.id} senza booking associato`);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        // NESSUNA logica di business: log server-side del dettaglio e stato pagamento fallito
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const lastError = paymentIntent.last_payment_error;
        logger.error(`payment_intent.payment_failed per payment_intent ${paymentIntent.id}`, {
          booking_id: paymentIntent.metadata?.booking_id,
          error_code: lastError?.code,
          decline_code: lastError?.decline_code,
          message: lastError?.message,
        });
        let book: any = await bookingServices.readByPaymentIntentId(paymentIntent.id);
        if (book?.numberOfTickets) {
          await bookingServices.updatePaymentStatus(book.numberOfTickets, "failed");
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const bookingId = charge.metadata?.booking_id;

        if (bookingId && charge.refunded) {
          let success = await bookingServices.refundBookingAdmin(bookingId);
          if (success) {
            await bookingServices.updatePaymentStatus(bookingId, "refunded");
            logger.info(`Rimborso effettuato per la prenotazione ${bookingId}`);
          } else {
            logger.info("Rimborso arrivato ma il ticket in uno stato non rimborsabile");
          }
        } else if (bookingId) {
          logger.info(`Rimborso parziale ricevuto per la prenotazione ${bookingId}, DB gia' aggiornato dalla API`);
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;

        if (bookingId) {
          // Idempotente: expireTicketById fa match SOLO con status 'pending':
          // se il pagamento e' arrivato nel frattempo (evento ritardato di
          // checkout.session.completed, booking gia' confirmed), la sessione
          // scaduta NON invalida la prenotazione pagata.
          const expired = await bookingServices.expireTicketById(bookingId);
          if (expired) {
            await bookingServices.updatePaymentStatus(bookingId, "failed");
            logger.info(`Pagamento scaduto per la prenotazione ${bookingId}`);
          } else {
            logger.warn(`checkout.session.expired per ${bookingId} ma il booking non e' piu' pending: nessun annullamento ${bookingId}`);
          }
        } else {
          logger.info(`checkout.session.expired senza booking_id (event ${event.id})`);
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        let book = await bookingServices.readByPaymentIntentId(dispute.payment_intent as string);
        const bookingId = book?.numberOfTickets;

        if (bookingId && new Date(book.date) > new Date()) {
          await bookingServices.cancelBooking(bookingId, dispute.reason as string);
        }
        logger.warn(`Contestazione aperta per la prenotazione ${bookingId}`);
        break;
      }
      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        let book = await bookingServices.readByPaymentIntentId(dispute.payment_intent as string);
        const bookingId = book?.numberOfTickets;

        if (bookingId && dispute.status === "lost") {
          await bookingServices.refundBookingAdmin(bookingId);
          await bookingServices.updatePaymentStatus(bookingId, "refunded");
          logger.warn(`Contestazione persa per la prenotazione ${bookingId}, biglietto rimborsato`);
        } else if (bookingId) {
          logger.info(`Contestazione chiusa per la prenotazione ${bookingId}, stato: ${dispute.status}`);
        }
        break;
      }
      case "charge.dispute.funds_withdrawn": {
        const dispute = event.data.object as Stripe.Dispute;
        let book = await bookingServices.readByPaymentIntentId(dispute.payment_intent as string);
        const bookingId = book?.numberOfTickets;

        if (bookingId) {
          await bookingServices.refundBookingAdmin(bookingId);
          await bookingServices.updatePaymentStatus(bookingId, "refunded");
          logger.warn(`Fondi prelevati per contestazione sulla prenotazione ${bookingId}`);
        }
        break;
      }

      default:
        logger.debug(`Evento non gestito: ${event.type}`);
    }

    return res.json({ received: true });
  } catch (error) {
    logger.error(`Errore nel webhook Stripe (event ${event.id}, tipo ${event.type}):`, error);
    // Rilascia il claim cosi' un retry di Stripe puo' riprocessare l'evento
    if (claimed) {
      try {
        await webhookEventsDao.releaseEvent(event.id);
      } catch (releaseError) {
        logger.error(`Impossibile rilasciare il claim dell'evento ${event.id}`, releaseError);
      }
    }
    // 500 cosi' Stripe riprova la consegna
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
