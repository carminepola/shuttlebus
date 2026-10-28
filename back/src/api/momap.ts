import { Router, Request, Response, NextFunction } from "express";
import { check, validationResult } from "express-validator";
import LicensePlateServices from "../components/services/licensePlateServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";

import { db, env, logger } from "../index"; // Assuming db is exported from index.ts

import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import momapServices from "../components/services/momapServices";
import { attachTrails } from "../components/services/busTrailServices";
const router = Router();

function getAllowedIps(): string[] {
  const allowedIps = env.MOMAP_ALLOWED_IPS || "";
  return allowedIps
    .split(",")
    .map((ip: string) => ip.trim())
    .filter((ip: string) => ip.length > 0);
}

function getCronSecret(): string {
  return (env.MOMAP_CRON_SECRET || "").trim();
}

/**
 * pentest: prima usava X-Real-IP/X-Forwarded-For letti GREZZAMENTE dagli header
 * (spoofabili da chiunque → whitelist aggirabile apponendo l'header). Ora si usa
 * req.ip, che con "trust proxy" attivo risolve l'IP del client SOLO se il proxy
 * e' quello fidato.
 */
router.post("/cron", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clientIp = req.ip || "";
    const allowedIps = getAllowedIps();
    const secret = getCronSecret();
    const providedSecret = String(req.headers["x-cron-secret"] || "");

    // Fail-closed (pentest: con MOMAP_ALLOWED_IPS vuoto l'endpoint era APERTO a tutti):
    // il cron e' invocabile SOLO da un IP nella whitelist OPPURE con il segreto corretto.
    const ipAllowed = allowedIps.length > 0 && allowedIps.includes(clientIp);
    const secretAllowed = secret.length > 0 && providedSecret.length > 0 && providedSecret === secret;
    if (!ipAllowed && !secretAllowed) {
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
    // pentest: la posizione e' pubblica (mappa tracking) ma l'IMEI e' un identificativo
    // del dispositivo wired: non va esposto a chiunque. Viene rimosso dalla risposta.
    const safePosition = (position || []).map((bus: any) => {
      if (bus && typeof bus === "object") {
        const { imei, ...rest } = bus;
        return rest;
      }
      return bus;
    });
    res.json({ position: await attachTrails(safePosition, (busId, lat, lng) => momap.getUpcomingStops(busId, lat, lng)) });
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
