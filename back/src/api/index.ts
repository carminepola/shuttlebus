import express from "express";

import messageResponse from "../model/messageModel";
import test from "./test";

import session from "./sessions";
import users from "./users";
import stops from "./stops";
import ticketType from "./ticketType";
import lng from "./lng";
import routes from "./routes";
import booking from "./booking";
import google from "./google";
import microsoft from "./microsoft";
import stripe from "./stripe";
import stripeWebhook from "./stripeWebhook";
import momap from "./momap";import licensePlate from "./licensePlate";
import depotSettings from "./depotSettings";
import attendance from "./attendance";

const router = express.Router();

router.get<{}, messageResponse>("/", (req, res, next) => {
  try {
    res.json({ message: "V1" });
  } catch (error) {
    next(error);
  }
});
router.use("/momap", momap);
router.use("/lng", lng);
router.use("/test", test);
router.use("/auth", session);
router.use("/users", users);
router.use("/stops", stops);
router.use("/ticketType", ticketType);
router.use("/routes", routes);
router.use("/booking", booking);
router.use("/google", google);
router.use("/microsoft", microsoft);
//Webhook Stripe: montato PRIMA del router stripe ("padre" primo vince su POST /webhook).
//Raggiungibile sia da /stripe/webhook (mount in app.ts, body RAW nativo) sia da qui
//sotto /api: in quello caso la firma usa la copia rawBody conservata da express.json.
router.use("/stripe", stripeWebhook);
router.use("/stripe", stripe);
router.use("/licensePlate", licensePlate);
router.use("/depotSettings", depotSettings);
router.use("/attendance", attendance);

export default router;
