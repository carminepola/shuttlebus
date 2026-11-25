import { Router, Request, Response, NextFunction } from "express";
import { check, query } from "express-validator";
import FiscalServices from "../components/services/fiscalServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import { db } from "../index";
import { MAX_VAT_RATE } from "../utils/fiscal";
import ErrorModel from "../model/errorModel";

/** Area commercialista: dati fiscali dei biglietti e corrispettivi. */
const router = Router();

const MAX_REPORT_DAYS = 400;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

router.get("/settings", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ settings: await new FiscalServices(db).getSettings() });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/settings",
  authMiddleware,
  [
    check("legalName").optional().isString().isLength({ max: 300 }),
    check("vatNumber").optional().isString().isLength({ max: 40 }),
    check("taxCode").optional().isString().isLength({ max: 40 }),
    check("address").optional().isString().isLength({ max: 300 }),
    check("vatRate").optional().isFloat({ min: 0, max: MAX_VAT_RATE }).withMessage(`vatRate must be between 0 and ${MAX_VAT_RATE}`),
    check("vatNote").optional().isString().isLength({ max: 300 }),
  ],
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // solo i campi previsti (niente mass-assignment)
      const patch: any = {};
      for (const k of ["legalName", "vatNumber", "taxCode", "address", "vatNote"]) {
        if (req.body[k] !== undefined) patch[k] = String(req.body[k]);
      }
      if (req.body.vatRate !== undefined) patch.vatRate = Number(req.body.vatRate);
      await new FiscalServices(db).updateSettings(patch);
      res.json({ message: "Fiscal settings updated" });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/report",
  authMiddleware,
  [query("from").matches(isoDate), query("to").matches(isoDate)],
  checkPermissionMiddleware(role.ADMIN, []),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const from = String(req.query.from);
      const to = String(req.query.to);
      const days = (Date.parse(to) - Date.parse(from)) / 86400000;
      if (!(days >= 0) || days > MAX_REPORT_DAYS) throw new ErrorModel(400, `Periodo non valido (massimo ${MAX_REPORT_DAYS} giorni)`);
      res.json(await new FiscalServices(db).report(from, to));
    } catch (error) {
      next(error);
    }
  },
);

export default router;
