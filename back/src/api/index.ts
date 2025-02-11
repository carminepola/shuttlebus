import express from "express";

import messageResponse from "../model/messageModel";
import test from "./test";
import exemple from "./exemple";
import session from "./sessions";
import users from "./users";
import stops from "./stops";
const router = express.Router();

router.get<{}, messageResponse>("/", (req, res, next) => {
  try {
    res.json({ message: "V1" });
  } catch (error) {
    next(error);
  }
});
router.use("/test", test);
router.use("/exemple", exemple);
router.use("/auth", session);
router.use("/users", users);
router.use("/stops", stops);

export default router;
