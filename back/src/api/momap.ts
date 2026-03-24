import { Router, Request, Response, NextFunction } from "express";
import { check, validationResult } from "express-validator";
import LicensePlateServices from "../components/services/licensePlateServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";

import { db } from "../index"; // Assuming db is exported from index.ts

import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import momapServices from "../components/services/momapServices";
const router = Router();

router.post("/cron", authMiddleware, checkPermissionMiddleware(role.ROOT, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let momap: momapServices = new momapServices(db);

    momap.cron();
    res.json({ message: "OK" });
  } catch (error) {
    next(error);
  }
});
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let momap: momapServices = new momapServices(db);

    let position = await momap.getCurrent();
    res.json({ position: position });
  } catch (error) {
    next(error);
  }
});

router.get("/devices", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let momap: momapServices = new momapServices(db);
    let devices = await momap.getUserDevices();
    res.json({ devices });
  } catch (error) {
    next(error);
  }
});
export default router;
