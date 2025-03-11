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
require("dotenv").config();
const router = express.Router();
import { role } from "../enum/role";

const stripe = StripeInstance.getInstance();
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res, next) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, endpointSecret);
  } catch (err) {
    logger.error("Errore nel webhook:", err);
    next(err);
  }

  try {
    let bookingServices = new BookingsServices(db);
    switch (event!.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;
        const paymentIntentId = session.payment_intent as string;
        if (bookingId) {
          let success = await bookingServices.confirmBooking(bookingId);

          if (success && paymentIntentId) {
            // Recupera il PaymentIntent per verificare lo stato del pagamento
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            if (paymentIntent.status === "requires_capture") {
              // Cattura il pagamento manualmente
              await stripe.paymentIntents.capture(paymentIntentId);
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
        const bookingId = dispute.metadata?.booking_id;

        if (bookingId) {
          await bookingServices.cancelBooking(bookingId);
        }
        logger.warn(`Contestazione aperta per la prenotazione ${bookingId}`);
        break;
      }

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
    let bookingServices = new BookingsServices(db);

    let book = await bookingServices.getBooking(req.body.id);
    if (!book) {
      throw new ErrorModel(404, "Prenotazione non trovata");
    }

    if (book.status === "confirmed" && (book.user.userId === res.locals.userLogged["_id"] || res.locals.userLogged["role"] === role.ADMIN)) {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      if (new Date(book.date) < threeDaysAgo) {
        throw new ErrorModel(400, "str_not_before_3_days");
      }
      if (res.locals.userLogged["role"] !== role.ADMIN) {
        const today = new Date().setHours(0, 0, 0, 0);

        if (new Date(book.date).setHours(0, 0, 0, 0) <= today) {
          throw new ErrorModel(400, "str_not_ticket_expired");
        }
      }

      const refund = await stripe.refunds.create({
        payment_intent: book.other.id,
      });
      let success = refund.status === "succeeded";
      if (success) {
        await bookingServices.cancelBooking(req.body.id);
      }
    }

    await bookingServices.refundBooking(req.body.id);
    res.json({ message: "Intent refunded" });
  } catch (error) {
    next(error);
  }
});

export default router;
