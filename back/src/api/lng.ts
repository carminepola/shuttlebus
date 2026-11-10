import { Router, Request, Response, NextFunction } from "express";
import { body, check } from "express-validator";
import { languageCodes } from "../i18n/languages";
import LngServices from "../components/services/lngServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";

import { db } from "../index"; // Assuming db is exported from index.ts

import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import ErrorModel from "../model/errorModel";
import ticketTypeModel from "../model/ticketTypeModel";
import { applyCompanyToText } from "../utils/company";
const router = Router();

/** I testi sono stringhe per lingue configurate (es. { it: "...", pt: "..." }): niente altri campi. */
const languageValuesCheck = body().custom(async (value: any) => {
  const codes = new Set(await languageCodes(db));
  for (const [key, text] of Object.entries(value || {})) {
    if (key === "id" || key === "txt") continue;
    if (!codes.has(key)) throw new Error(`Lingua non configurata: ${key}`);
    if (typeof text !== "string") throw new Error(`Il testo per ${key} deve essere una stringa`);
  }
  return true;
});

router.post(
  "/",
  authMiddleware,
  [
    check("id").isEmpty().withMessage("Id not required"),
    check("txt").isString().matches(/^[A-Za-z0-9_.-]{1,120}$/).withMessage("txt must be a key (letters, digits, _ . -)"),
    languageValuesCheck,
  ],

  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let lngServices = new LngServices(db);
      const id = await lngServices.create(req.body);
      res.status(201).json({ message: "lng Created", id: id });
    } catch (error) {
      next(error);
    }
  },
);
router.patch(
  "/",
  authMiddleware,
  [
    check("id").notEmpty().withMessage("Id is required"),
    languageValuesCheck,
  ],

  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let lngServices = new LngServices(db);
      const id = await lngServices.update(req.body);
      res.status(201).json({ message: "lng Created", id: id });
    } catch (error) {
      next(error);
    }
  },
);
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let lngServices = new LngServices(db);
    const lng: any[] = await lngServices.getAll();
    // ?raw=true (pagina admin Traduzioni): testi con i segnaposto {{company}}, da modificare cosi'
    if (req.query.raw === "true") {
      res.json({ lng });
      return;
    }
    // app: nome e ragione sociale dell'azienda dal .env (COMPANY_NAME, COMPANY_LEGAL_NAME)
    res.json({ lng: lng.map((row: any) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, k === "txt" || k === "id" ? v : applyCompanyToText(v as string)]))) });
  } catch (error) {
    next(error);
  }
});
router.delete(
  "/:id",
  // pentest: prima senza alcuna autenticazione (DELETE traduzioni aperto a chiunque)
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let lngServices = new LngServices(db);
      const id = req.params.id;
      await lngServices.delete(id);
      res.json({ message: "lng deleted" });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
