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
import stripe from "./stripe";
import momap from "./momap";
import licensePlate from "./licensePlate";
import depotSettings from "./depotSettings";

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
router.use("/stripe", stripe);
router.use("/licensePlate", licensePlate);
router.use("/depotSettings", depotSettings);

export default router;
