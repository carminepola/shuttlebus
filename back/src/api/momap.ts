import { Router, Request, Response, NextFunction } from "express";
import { check, validationResult } from "express-validator";
import LicensePlateServices from "../components/services/licensePlateServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";

import { db, env, logger } from "../index"; // Assuming db is exported from index.ts

import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import momapServices from "../components/services/momapServices";
const router = Router();

function getAllowedIps(): string[] {
  const allowedIps = env.MOMAP_ALLOWED_IPS || "";
  return allowedIps
    .split(",")
    .map((ip: string) => ip.trim())
    .filter((ip: string) => ip.length > 0);
}

function getClientIp(req: Request): string {
  const xForwardedFor = req.headers["x-forwarded-for"];
  const xRealIp = req.headers["x-real-ip"];

  if (typeof xRealIp === "string" && xRealIp) {
    return xRealIp;
  }

  if (typeof xForwardedFor === "string" && xForwardedFor) {
    const ips = xForwardedFor.split(",");
    return ips[ips.length - 1].trim();
  }

  return req.socket.remoteAddress || "";
}

router.post("/cron", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientIp = getClientIp(req);
    const allowedIps = getAllowedIps();

    if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
      logger.warn(`Accesso momap/cron negato da IP: ${clientIp}`);
      return res.sendStatus(403);
    }

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

router.get("/busStatus", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let momap: momapServices = new momapServices(db);

    let busStatus = await momap.getBusStatus();
    res.json({ busStatus: busStatus });
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
