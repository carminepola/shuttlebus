import express from "express";
import Stripe from "stripe";
import { logger, env } from "../index";
import StripeInstance from "../stripe";
const router = express.Router();

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

export default router;
