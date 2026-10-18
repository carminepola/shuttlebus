import express from "express";
import { logger, db } from "../index";
import StripeInstance from "../stripe";
import StripeServices from "../components/services/stripeServices";
import BookingsServices from "../components/services/bookingServices";
import authMiddleware from "../middlewares/authMiddleware";
import ErrorModel from "../model/errorModel";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
require("dotenv").config();
const router = express.Router();
import { role } from "../enum/role";

const stripe = StripeInstance.getInstance();

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
    if (book.status === "confirmed") {
      if (book.userId === res.locals.userLogged["_id"] || res.locals.userLogged["role"] <= role.ADMIN) {
        logger.info("check permessi rimborso 1 " + req.body.id);
        if (res.locals.userLogged["role"] > role.ADMIN) {
          logger.info("check permessi rimborso  2" + req.body.id);
          if (new Date(book.date).getTime() - 3 * 24 * 60 * 60 * 1000 < new Date().getTime()) {
            throw new ErrorModel(400, "str_not_before_3_days");
          }
          const today = new Date().setHours(0, 0, 0, 0);

          if (new Date(book.date).setHours(0, 0, 0, 0) <= today) {
            throw new ErrorModel(400, "str_not_ticket_expired");
          }
        }

        const isAdmin = res.locals.userLogged["role"] <= role.ADMIN;
        const refundItems: { ticketTypeId: string; count: number }[] = req.body.items || [];
        const refundLuggageCount: number = req.body.luggage || 0;

        if (refundItems.length > 0 || refundLuggageCount > 0) {
          let requestedAmount = 0;
          let refundedSeats = 0;
          for (const item of refundItems) {
            const ticketType = book.ticketTypes.find((tt: any) => tt.id === item.ticketTypeId);
            if (!ticketType) {
              throw new ErrorModel(400, "str_refund_invalid_ticket");
            }
            if (!item.count || item.count <= 0 || item.count > ticketType.count) {
              throw new ErrorModel(400, "str_refund_exceeds_count");
            }
            requestedAmount += item.count * ticketType.cost;
            refundedSeats += item.count;
          }

          const LUGGAGE_PRICE = 2;
          if (refundLuggageCount < 0 || refundLuggageCount > book.luggage) {
            throw new ErrorModel(400, "str_refund_exceeds_luggage");
          }
          requestedAmount += refundLuggageCount * LUGGAGE_PRICE;

          if (requestedAmount <= 0) {
            throw new ErrorModel(400, "str_refund_no_items");
          }

          logger.info("Rimborso parziale iniziato per la prenotazione " + req.body.id + " importo: " + requestedAmount);
          const refund = await stripe.refunds.create({
            payment_intent: book.paymentIntentId,
            amount: Math.round(requestedAmount * 100),
          });

          if (refund.status === "succeeded" || refund.status === "pending") {
            risposta = await bookingServices.partialRefundBookingAdmin(req.body.id, requestedAmount, refundItems, refundedSeats, refundLuggageCount);
          } else {
            logger.error("Rimborso Stripe fallito per la prenotazione " + req.body.id + " status: " + refund.status);
            throw new ErrorModel(400, "str_refund_error");
          }
        } else {
          logger.info("Rimborso totale iniziato per la prenotazione " + req.body.id);
          const refund = await stripe.refunds.create({
            payment_intent: book.paymentIntentId,
          });

          if (refund.status === "succeeded" || refund.status === "pending") {
            if (isAdmin) {
              risposta = await bookingServices.refundBookingAdmin(req.body.id);
            } else {
              risposta = await bookingServices.refundBooking(req.body.id);
            }
          } else {
            logger.error("Rimborso Stripe fallito per la prenotazione " + req.body.id + " status: " + refund.status);
            throw new ErrorModel(400, "str_refund_error");
          }
        }
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
router.get("/getPayouts", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  try {
    let stripeServices = new StripeServices();
    let pay = await stripeServices.getPayouts();
    res.json({ result: pay });
  } catch (error) {
    next(error);
  }
});
router.get("/getBalance", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  try {
    let stripeServices = new StripeServices();
    let pay = await stripeServices.getBalance();
    res.json({ result: pay });
  } catch (error) {
    next(error);
  }
});
router.get("/getAccountSchedule", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  try {
    let stripeServices = new StripeServices();
    let pay = await stripeServices.getAccountSchedule();
    res.json({ result: pay });
  } catch (error) {
    next(error);
  }
});
router.get("/getRefunds", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  try {
    let stripeServices = new StripeServices();
    let refunds = await stripeServices.getRefunds();
    res.json({ result: refunds });
  } catch (error) {
    next(error);
  }
});
router.get("/getDisputes", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  try {
    let stripeServices = new StripeServices();
    let disputes = await stripeServices.getDisputes();
    res.json({ result: disputes });
  } catch (error) {
    next(error);
  }
});
router.post("/closeDispute", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  try {
    let stripeServices = new StripeServices();
    await stripeServices.closeDispute(req.body.disputeId);
    res.json({ message: "Dispute closed" });
  } catch (error) {
    next(error);
  }
});
router.get("/getTransactionsByEmail/:email", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  try {
    let stripeServices = new StripeServices();
    let transactions = await stripeServices.getTransactionsByEmail(req.params.email);
    res.json({ result: transactions });
  } catch (error) {
    next(error);
  }
});
router.get("/getMonthlyRevenue", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  res.status(410).json({ message: "Use /booking/getMonthlyRevenue instead" });
});
router.get("/paymentIntents", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  try {
    let stripeServices = new StripeServices();
    let result = await stripeServices.getAllPaymentIntents({
      limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      starting_after: req.query.starting_after as string,
      next_page: req.query.next_page as string,
      status: req.query.status as string,
      search: req.query.search as string,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});
router.get("/paymentIntents/:id", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req, res, next) => {
  try {
    let stripeServices = new StripeServices();
    let result = await stripeServices.getPaymentIntentDetail(req.params.id);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});
export default router;
