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
  },
);
router.post("/insertBooking", authMiddleware, checkPermissionMiddleware(role.USER, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let book = req.body;
    let userRole = res.locals.userLogged?.role;
    if (book.paymentType === "cash" && (!userRole || userRole > role.DRIVER)) {
      res.status(403).json({ message: "str_error_cash_not_allowed" });
      return;
    }
    let bookingServices = new BookingServices(db);

    let response: any = await bookingServices.insertBooking(book, res.locals.userLogged["_id"]);

    if (typeof response === "object" && response.type === "cash") {
      res.json({ url: `/payment/cash/success/${response.bookingId}` });
    } else {
      res.json({ url: response });
    }
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
      let result = await bookingServices.readBookingConfirmed(req.body.date, req.body.routeId, req.body.scheduleId, req.body.status);
      res.json({ ticket: result });
    } catch (error) {
      next(error);
    }
  },
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

router.get("/hasTicketForRoute", authMiddleware, checkPermissionMiddleware(role.USER, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const routeId = req.query.routeId as string;
    const date = req.query.date as string;
    const fromStopId = req.query.fromStopId as string;
    const toStopId = req.query.toStopId as string;
    if (!routeId || !date || !fromStopId || !toStopId) {
      res.status(400).json({ message: "routeId, date, fromStopId and toStopId are required" });
      return;
    }
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.hasTicketForRoute(res.locals.userLogged["_id"], routeId, date, fromStopId, toStopId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/getBookingByUserId/:userId", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.getBookingFromUser(req.params.userId);
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
router.post("/cancelBooking", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.cancelBooking(req.body.id);
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
    res.json({ ticket: result[0]?.totalTickets || 0 });
  } catch (error) {
    next(error);
  }
});
router.get("/seatsToDay", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.seatsToDay();
    res.json({ seats: result[0]?.totalTickets || 0 });
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
router.get("/andamentoVendite", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.andamentoVendite();
    res.json({ andamento: result });
  } catch (error) {
    next(error);
  }
});
router.post("/currentDayBookingsFromScheduleId", authMiddleware, checkPermissionMiddleware(role.DRIVER, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);

    let scheduleId: string = req.body.scheduleId;
    let result = await bookingServices.currentDayBookingsFromScheduleId(scheduleId);
    res.json({ bookings: result });
  } catch (error) {
    next(error);
  }
});
router.post("/readBookingById", authMiddleware, checkPermissionMiddleware(role.DRIVER, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);

    let id: string = req.body.id;
    let result = await bookingServices.getBooking(id);
    res.json({ bookings: result });
  } catch (error) {
    next(error);
  }
});

router.post("/scanTicket", authMiddleware, checkPermissionMiddleware(role.DRIVER, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let id: string = req.body.id;
    let user = res.locals.userLogged;
    let driverName = user.details?.name || user.email || user._id;
    let result = await bookingServices.scanTicket(id, user._id, driverName);
    if (!result) {
      res.json({ found: false });
    } else {
      res.json({ found: true, ...result });
    }
  } catch (error) {
    next(error);
  }
});

router.get("/topClients", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.topClients();
    res.json({ topClients: result });
  } catch (error) {
    next(error);
  }
});

router.get("/recentPurchases", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let page = parseInt(req.query.page as string) || 1;
    let limit = parseInt(req.query.limit as string) || 20;
    let result = await bookingServices.recentPurchases(page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/dashboardStats", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.dashboardStats();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/yearlyStats", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.yearlyStats();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/revenueByPaymentMethod", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let startDate = req.query.startDate as string | undefined;
    let endDate = req.query.endDate as string | undefined;
    let result = await bookingServices.revenueByPaymentMethod(startDate, endDate);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/dailyRevenueByRoute", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let date = req.query.date as string;
    if (!date) {
      res.status(400).json({ message: "date is required" });
      return;
    }
    let result = await bookingServices.dailyRevenueByRoute(date);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

router.get("/getMonthlyRevenue", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let revenue = await bookingServices.getMonthlyRevenue();
    res.json({ result: revenue });
  } catch (error) {
    next(error);
  }
});

router.get("/yearlyComparison", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let bookingServices = new BookingServices(db);
    let result = await bookingServices.yearlyComparison();
    res.json(result);
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
