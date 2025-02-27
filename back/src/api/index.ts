import express from "express";

import messageResponse from "../model/messageModel";
import test from "./test";

import session from "./sessions";
import users from "./users";
import stops from "./stops";
import images from "./images";
import ticketType from "./ticketType";
import lng from "./lng";
const router = express.Router();

router.get<{}, messageResponse>("/", (req, res, next) => {
  try {
    res.json({ message: "V1" });
  } catch (error) {
    next(error);
  }
});
router.use("/lng", lng);
router.use("/test", test);
router.use("/auth", session);
router.use("/users", users);
router.use("/stops", stops);
router.use("/images", images);
router.use("/ticketType", ticketType);
export default router;
