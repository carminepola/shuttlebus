import { Router, Request, Response, NextFunction } from "express";
import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import { db } from "../index";
import ErrorModel from "../model/errorModel";
import { getLanguageSettings, saveLanguageSettings, validateLanguageSettings } from "../i18n/languages";

const router = Router();

/** Lingue configurate (anche quelle disattivate, con enabled=false) e lingua predefinita. */
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await getLanguageSettings(db));
  } catch (error) {
    next(error);
  }
});

/** Sostituisce l'elenco delle lingue (Impostazioni -> Lingue). */
router.put("/", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { settings, error } = validateLanguageSettings(req.body);
    if (!settings) throw new ErrorModel(400, error || "Configurazione lingue non valida");
    await saveLanguageSettings(db, settings);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

export default router;
