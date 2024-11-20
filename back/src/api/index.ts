import express from "express";

import messageResponse from "../model/messageModel";
import test from "./test";
import exemple from "./exemple"
const router = express.Router();

router.get<{}, messageResponse>("/", (req, res, next) => {
  try {
    res.json({ message: "V1" });
  } catch (error) {
    next(error);
  }
});
router.use("/test", test);
router.use("/exemple",exemple);

export default router;
