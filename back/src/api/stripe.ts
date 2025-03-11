import express from "express";
import Stripe from "stripe";
import { logger, env, db } from "../index";
import StripeInstance from "../stripe";
import StripeServices from "../components/services/stripeServices";
import BookingsServices from "../components/services/bookingServices";
import authMiddleware from "../middlewares/authMiddleware";
import UserServices from "../components/services/userServices";
import ErrorModel from "../model/errorModel";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
const router = express.Router();
import { role } from "../enum/role";

const stripe = StripeInstance.getInstance();
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res, next) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, endpointSecret);
  } catch (err) {
    logger.error("Errore nel webhook:", err);
    next(err);
  }

  switch (event!.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;

      if (bookingId) {
        //await updateBookingStatus(bookingId, "pagato");
      }
      logger.info(`Pagamento confermato per la prenotazione ${bookingId}`);
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const bookingId = charge.metadata?.booking_id;

      if (bookingId) {
        // await updateBookingStatus(bookingId, "rimborsato");
      }
      logger.info(`Rimborso effettuato per la prenotazione ${bookingId}`);
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;

      if (bookingId) {
        //await updateBookingStatus(bookingId, "scaduto");
      }
      logger.info(`Pagamento scaduto per la prenotazione ${bookingId}`);
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const bookingId = dispute.metadata?.booking_id;

      if (bookingId) {
        // await updateBookingStatus(bookingId, "contestato");
      }
      logger.warn(`Contestazione aperta per la prenotazione ${bookingId}`);
      break;
    }

    default:
      logger.debug(`Evento non gestito: ${event!.type}`);
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

    await bookingServices.cancelBooking(req.body.id, user);
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

    await bookingServices.cancelBooking(req.body.id);
    stripeServices.deletePaymentSession(book.other.id);

    res.json({ message: "Intent deleted" });
  } catch (error) {
    next(error);
  }
});
export default router;
