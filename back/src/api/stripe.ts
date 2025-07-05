import express from "express";
import Stripe from "stripe";
import { logger, db } from "../index";
import StripeInstance from "../stripe";
import StripeServices from "../components/services/stripeServices";
import BookingsServices from "../components/services/bookingServices";
import authMiddleware from "../middlewares/authMiddleware";
import UserServices from "../components/services/userServices";
import ErrorModel from "../model/errorModel";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import TelegramServices from "../components/services/telegramServices";
require("dotenv").config();
const router = express.Router();
import { role } from "../enum/role";
import { log } from "console";

const stripe = StripeInstance.getInstance();
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res, next) => {
  logger.info("Webhook ricevuto cifrato");
  let event = req.body;
  // Only verify the event if you have an endpoint secret defined.
  // Otherwise use the basic event deserialized with JSON.parse
  if (process.env.WEBHOOK_SECRET) {
    // Get the signature sent by Stripe
    const signature = req.headers["stripe-signature"];
    try {
      event = stripe.webhooks.constructEvent(req.body, signature!, process.env.WEBHOOK_SECRET);
    } catch (err) {
      throw err;
    }
  }

  logger.info("Webhook ricevuto:", event!.type);
  try {
    let bookingServices = new BookingsServices(db);
    switch (event!.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        const paymentIntentId = session.payment_intent as string;
        if (bookingId) {
          let success = await bookingServices.confirmBooking(bookingId);
          await bookingServices.updatePaymentIntentId(bookingId, paymentIntentId);
          if (paymentIntentId) {
            // Recupera il PaymentIntent per verificare lo stato del pagamento
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            if (paymentIntent.status === "requires_capture") {
              // Cattura il pagamento manualmente
              let res = await stripe.paymentIntents.capture(paymentIntentId);

              if (res.status !== "succeeded") {
                await bookingServices.expireTicketById(bookingId);
                throw new ErrorModel(400, "str_payment_failed");
              }

              bookingServices.sendConfirmation(bookingId);

              logger.info(`Pagamento catturato con successo per la prenotazione ${bookingId}`);
            } else {
              logger.info(`Il pagamento per la prenotazione ${bookingId} è già stato addebitato.`);
            }
          } else if (!success && paymentIntentId) {
            // Se la prenotazione NON è confermata, annulla il pagamento per sbloccare i fondi
            await stripe.paymentIntents.cancel(paymentIntentId);
            logger.info(`Pagamento annullato per la prenotazione ${bookingId}, i fondi sono stati sbloccati.`);
          }
        }

        logger.info(`Pagamento confermato per la prenotazione ${bookingId}`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const bookingId = charge.metadata?.booking_id;

        if (bookingId) {
          let success = await bookingServices.refundBooking(bookingId);
          if (success) {
            logger.info(`Rimborso effettuato per la prenotazione ${bookingId}`);
          } else {
            logger.info("Rimborso arrivato ma il ticket in uno stato non rimborsabile");
          }
        }

        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;

        if (bookingId) {
          bookingServices.expireTicketById(bookingId);
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
      case "payment_intent.intent.succeeded":
        break;

      default:
        logger.debug(`Evento non gestito: ${event!.type}`);
    }
  } catch (error) {
    logger.error("Errore nel webhook:", error);
    next(error);
  }
  res.json({ received: true });
});

router.post("/delete", authMiddleware, async (req, res, next) => {
  try {
    let bookingServices = new BookingsServices(db);
    let stripeServices = new StripeServices();

    let user = res.locals.userLogged["_id"];

    if (!user) {
      throw new ErrorModel(404, "Utente non trovato");
    }
    let book = await bookingServices.getBooking(req.body.id);
    if (!book) {
      throw new ErrorModel(404, "Prenotazione non trovata");
    }

    await bookingServices.deleteBooking(req.body.id, user);
    await stripeServices.deletePaymentSession(book.other.id);
    res.json({ message: "Intent deleted" });
  } catch (error) {
    next(error);
  }
});
router.post("/forceDelete", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  try {
    let bookingServices = new BookingsServices(db);
    let stripeServices = new StripeServices();

    let book = await bookingServices.getBooking(req.body.id);
    if (!book) {
      throw new ErrorModel(404, "Prenotazione non trovata");
    }

    await bookingServices.deleteBooking(req.body.id);

    stripeServices.deletePaymentSession(book.other.id);

    res.json({ message: "Intent deleted" });
  } catch (error) {
    next(error);
  }
});
router.post("/refund", authMiddleware, async (req, res, next) => {
  try {
    logger.info("Rimborso tentativo per la prenotazione " + req.body.id);
    let bookingServices = new BookingsServices(db);
    let risposta = false;

    let book = await bookingServices.getBooking(req.body.id);
    if (!book) {
      throw new ErrorModel(404, "Prenotazione non trovata");
    }

    logger.info("preso il book ", book);
    logger.info("ruolo" + res.locals.userLogged["role"]);
    if (book.status === "confirmed" && (book.userId === res.locals.userLogged["_id"] || res.locals.userLogged["role"] <= role.ADMIN)) {
      logger.info("check permessi rimborso 1 " + req.body.id);
      if (res.locals.userLogged["role"] !== role.ADMIN) {
        logger.info("check permessi rimborso  2" + req.body.id);
        if (new Date(book.date).getTime() - 3 * 24 * 60 * 60 * 1000 < new Date().getTime()) {
          throw new ErrorModel(400, "str_not_before_3_days");
        }
        const today = new Date().setHours(0, 0, 0, 0);

        if (new Date(book.date).setHours(0, 0, 0, 0) <= today) {
          throw new ErrorModel(400, "str_not_ticket_expired");
        }
      }

      logger.info("Rimborso tentativo iniziato per la prenotazione " + req.body.id);
      try {
        const refund = await stripe.refunds.create({
          payment_intent: book.paymentIntentId,
        });
      } catch (error) {
        logger.debug("already refunded " + req.body.id);
      }
      logger.info("Rimborso in corso iniziato per la prenotazione " + req.body.id);
      if (role.ADMIN !== res.locals.userLogged["role"]) {
        logger.info("Rimborso effettuato per la prenotazione " + req.body.id);
        risposta = await bookingServices.refundBooking(req.body.id);
      } else {
        logger.info("Rimborso amministratore effettuato per la prenotazione " + req.body.id);
        risposta = await bookingServices.refundBookingAdmin(req.body.id);
      }
    }

    if (risposta) {
      logger.info("Rimborso effettuato" + req.body.id);
      res.json({ message: "Intent refunded" });
    } else {
      logger.info("Rimborso non riuscito " + req.body.id);
      throw new ErrorModel(400, "str_refund_error");
    }
  } catch (error) {
    next(error);
  }
});

export default router;
