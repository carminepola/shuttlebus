import express from "express";
import { db, logger } from "../index";
import { check, validationResult } from "express-validator";

import { Router, Request, Response, NextFunction } from "express";
import BookingServices from "../components/services/bookingServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
const router = express.Router();

router.post(
  "/findAvailableRoutes",
  [
    check("travelDate").notEmpty().withMessage("travelDate is required").isISO8601().withMessage("Invalid date format"),
    check("fromStopId").notEmpty().withMessage("fromStopId is required"),
    check("toStopId").notEmpty().withMessage("toStopId is required"),
    check("posti").notEmpty().withMessage("posti is required").isInt().withMessage("posti must be a number"),
    check("bagagli").notEmpty().withMessage("bagagli is required").isInt().withMessage("bagagli must be a number"),
  ],

  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let bookingServices = new BookingServices(db);
      let booking = {
        travelDate: req.body.travelDate,
        fromStopId: req.body.fromStopId,
        toStopId: req.body.toStopId,
        posti: req.body.posti,
        bagagli: req.body.bagagli,
      };
      let result = await bookingServices.findAvailableRoutes(booking.travelDate, booking.fromStopId, booking.toStopId, booking.posti, booking.bagagli);
      res.json({ result: result });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  }
);
export default router;
