import express, { response } from "express";
import { db, logger } from "../index";
import { check, validationResult } from "express-validator";

import { Router, Request, Response, NextFunction } from "express";
import BookingServices from "../components/services/bookingServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import { url } from "inspector";

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
router.post("/insertBooking", authMiddleware, checkPermissionMiddleware(role.USER, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let book = req.body;
    let bookingServices = new BookingServices(db);

    let response: any = await bookingServices.insertBooking(book, res.locals.userLogged["_id"]);

    res.json({ url: response });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/readBookingConfirmed",
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, []),
  [check("date").notEmpty().withMessage("date is required").isISO8601().withMessage("Invalid date format")],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let bookingServices = new BookingServices(db);
      let result = await bookingServices.readBookingConfirmed(req.body.date, req.body.routeId, req.body.scheduleId);
      res.json({ ticket: result });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/getBookingFromUser", authMiddleware, checkPermissionMiddleware(role.USER, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    await bookingServices.removeExpiredPendingBookings();
    let result = await bookingServices.getBookingFromUser(res.locals.userLogged["_id"]);

    res.json({ booking: result });
  } catch (error) {
    next(error);
  }
});
router.post("/refundBooking", authMiddleware, checkPermissionMiddleware(role.USER, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.refundBooking(req.body.id, res.locals.userLogged["_id"]);
    res.json({ message: "Rimborso effettuato" });
  } catch (error) {
    next(error);
  }
});
router.post("/deleteBooking", authMiddleware, checkPermissionMiddleware(role.USER, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.deleteBooking(req.body.id, res.locals.userLogged["_id"]);

    res.json({ message: "Booking deleted" });
  } catch (error) {
    next(error);
  }
});
router.get("/ticketToDay", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.ticketToDay();
    res.json({ ticket: result[0].totalTickets || 0 });
  } catch (error) {
    next(error);
  }
});
router.get("/seatsToDay", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.seatsToDay();
    res.json({ seats: result[0].totalTickets || 0 });
  } catch (error) {
    next(error);
  }
});

router.get("/andamento", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.andamento();
    res.json({ andamento: result });
  } catch (error) {
    next(error);
  }
});
export default router;

/*
db.routes.aggregate([
  {
    $match: {
      "schedules.startDate": { $lte: "2025-12-31" },
      "schedules.endDate": { $gte: "2025-12-31" },
      "schedules.status": "active"
    }
  },
  {
    $unwind: "$schedules"
  },
  {
    $match: {
      "schedules.startDate": { $lte: "2025-12-31" },
      "schedules.endDate": { $gte: "2025-12-31" },
      "schedules.status": "active"
    }
  },
  {
    $unwind: "$schedules.stops"
  },
  {
    $addFields: {
      "schedules.stops.stopTime": {
        $dateFromString: {
          dateString: { $concat: ["2025-12-31", " ", "$schedules.stops.stopTime"] },
          format: "%Y-%m-%d %H:%M"
        }
      }
    }
  },
  {
    $group: {
      _id: "$_id",
      name: { $first: "$name" },
      routeId: { $first: "$id" },
      scheduleId: { $first: "$schedules.id" },
      stops: { $push: "$schedules.stops" }
    }
  },
  {
    $addFields: {
      sortedStops: {
        $sortArray: {
          input: "$stops",
          sortBy: { stopTime: 1 }
        }
      }
    }
  },
  {
    $addFields: {
      previousStop: {
        $arrayElemAt: [
          {
            $filter: {
              input: "$sortedStops",
              as: "stop",
              cond: { $lte: ["$$stop.stopTime", new Date("2025-12-31T18:29:00Z")] }
            }
          },
          -1
        ]
      },
      nextStop: {
        $arrayElemAt: [
          {
            $filter: {
              input: "$sortedStops",
              as: "stop",
              cond: { $gt: ["$$stop.stopTime", new Date("2025-12-31T18:29:00Z")] }
            }
          },
          0
        ]
      }
    }
  },
  {
    $project: {
      _id: 0,
      routeId: 1,
      scheduleId: 1,
      "previousStop.id": 1,
      "previousStop.stopTime": 1,
      "nextStop.id": 1,
      "nextStop.stopTime": 1
    }
  }
]);

*/
