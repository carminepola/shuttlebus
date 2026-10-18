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
  if (!Buffer.isBuffer(req.body)) {
    logger.warn("Webhook Stripe rifiutato: body non ricevuto raw (verificare il mount prima di express.json)");
    return res.status(400).send("Body raw richiesto");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
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
        const paymentIntentId = session.payment_intent as string;
        if (bookingId) {
          await bookingServices.updatePaymentIntentId(bookingId, paymentIntentId);

          let success = await bookingServices.confirmBooking(bookingId, session.id);
          if (success && paymentIntentId) {
            // Recupera il PaymentIntent per verificare lo stato del pagamento (capture manuale)
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            if (paymentIntent.status === "requires_capture") {
              const captured = await stripe.paymentIntents.capture(paymentIntentId);
              if (captured.status !== "succeeded") {
                await bookingServices.expireTicketById(bookingId);
                await bookingServices.updatePaymentStatus(bookingId, "failed");
                logger.error(`Cattura pagamento fallita per la prenotazione ${bookingId} (event ${event.id})`);
                throw new Error("str_payment_failed");
              }
              await bookingServices.updatePaymentStatus(bookingId, "paid");
              bookingServices.sendConfirmation(bookingId);
              logger.info(`Pagamento catturato con successo per la prenotazione ${bookingId}`);
            } else if (paymentIntent.status === "succeeded") {
              await bookingServices.updatePaymentStatus(bookingId, "paid");
              logger.info(`Il pagamento per la prenotazione ${bookingId} e' gia' stato addebitato.`);
            } else {
              logger.warn(`Stato payment_intent inatteso ${paymentIntent.status} per la prenotazione ${bookingId}`);
            }
          } else if (!success && paymentIntentId) {
            // Prenotazione gia' confermata o session ID non corrisponde: annulla il pagamento
            await stripe.paymentIntents.cancel(paymentIntentId);
            logger.info(`Pagamento annullato per la prenotazione ${bookingId}, conferma non riuscita (gia' confermata o session non valida).`);
          }
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const bookingId = paymentIntent.metadata?.booking_id;
        let book: any = await bookingServices.readByPaymentIntentId(paymentIntent.id);
        if (!book && bookingId) {
          book = await bookingServices.getBooking(bookingId);
        }
        if (book?.numberOfTickets) {
          await bookingServices.updatePaymentStatus(book.numberOfTickets, "paid");
          logger.info(`payment_intent.succeeded: payment_status=paid per la prenotazione ${book.numberOfTickets}`);
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
          await bookingServices.expireTicketById(bookingId);
          await bookingServices.updatePaymentStatus(bookingId, "failed");
        }
        logger.info(`Pagamento scaduto per la prenotazione ${bookingId}`);
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
