import express from "express";
import { db } from "../index";
import RoutesServices from "../components/services/routesServices";
const router = express.Router();
import { Request, Response, NextFunction } from "express";
import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import { check } from "express-validator";

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let routesServices = new RoutesServices(db);
    const result = await routesServices.getRoutes();
    res.json({ routes: result });
  } catch (error) {
    next(error);
  }
});

router.post("/", [check("route").notEmpty().withMessage("route data is required")], authMiddleware, validateDataMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let routesServices = new RoutesServices(db);
    const result = await routesServices.insertRoute(req.body.route);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.put(
  "/:id",
  [
    check("name.it").optional().isString().withMessage("name in Italian must be a string"),
    check("name.en").optional().isString().withMessage("name in English must be a string"),
    check("stops").isArray().withMessage("stops must be an array"),
    check("ticketTypes").isArray().withMessage("ticketTypes must be an array"),
    check("enabled").isBoolean().withMessage("enabled must be a boolean"),
  ],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let routesServices = new RoutesServices(db);
      const { nameIt, nameEn, stops, ticketTypes, enabled } = req.body;
      const result = await routesServices.updateRoute(nameIt, nameEn, stops, ticketTypes, req.params.id, enabled);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.delete("/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let routesServices = new RoutesServices(db);
    const result = await routesServices.deleteRoute(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/enabled", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let routesServices = new RoutesServices(db);
    const result = await routesServices.getEnabledRoutes();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post(
  "/schedule/:id",
  [check("schedule").notEmpty().withMessage("schedule data is required")],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let routesServices = new RoutesServices(db);
      const result = await routesServices.insertSchedule(req.body.schedule, req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  "/schedule/:id/:scheduleId",
  [check("schedule").notEmpty().withMessage("schedule data is required")],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let routesServices = new RoutesServices(db);
      const result = await routesServices.updateSchedule(req.params.scheduleId, req.body.schedule, req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
router.get("/routesToday", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let routesServices = new RoutesServices(db);
    const result = await routesServices.getRoutesToDay();
    res.json({ routes: result[0].active_schedules_today || 0 });
  } catch (error) {
    next(error);
  }
});
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let routesServices = new RoutesServices(db);
    const result = await routesServices.getRouteById(req.params.id);
    res.json({ route: result });
  } catch (error) {
    next(error);
  }
});
export default router;
