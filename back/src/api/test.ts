import express from "express";
const router = express.Router();
import authMiddleware from "../middlewares/authMiddleware";
router.get("/", async (req, res, next) => {
  try {
    res.locals.response.message = "OK";

    res.json({
      headers: req.headers,
      ip: res.locals.log.ip,
      req: req.query,
    });
  } catch (error) {
    next(error);
  }
});
router.post("/", async (req, res, next) => {
  try {
    res.locals.response.message = "OK";

    res.json({
      headers: req.headers,
      ip: res.locals.log.ip,
      body: req.body,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
