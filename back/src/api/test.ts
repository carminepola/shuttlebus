import express, { Request, Response, NextFunction } from "express";
const router = express.Router();
import { check } from "express-validator";
import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import { role } from "../enum/role";
import ErrorModel from "../model/errorModel";
import MailService from "../components/services/mailServices";
import { Mail } from "../model/mailModel";
import { db, logger, env } from "../index";

router.get("/", async (req, res, next) => {
  try {
    res.locals.response.message = "OK";

    res.json({
      headers: req.headers,
      ip: res.locals.log.ip,
      req: req.query,
    });
  } catch (error) {
    next(error);
  }
});
router.post("/", async (req, res, next) => {
  try {
    res.locals.response.message = "OK";

    res.json({
      headers: req.headers,
      ip: res.locals.log.ip,
      body: req.body,
    });
  } catch (error) {
    next(error);
  }
});

const ALLOWED_MAIL_TYPES = ["WELCOME", "RECOVER_PASSWORD", "PURCHASE_COMPLETED", "PURCHASE_CANCELLED", "REFUND_PROCESSED", "GENERIC"];
const ALLOWED_MAIL_LNG = ["it", "en", "fr", "de", "es", "jp"];

function buildMailType(base: string, lng: string): string {
  if (lng === "it") return base;
  return `${base}_${lng.toUpperCase()}`;
}

router.post(
  "/mail",
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  [
    check("type").notEmpty().withMessage("type is required").isIn(ALLOWED_MAIL_TYPES).withMessage("Tipo di email non consentito"),
    check("to").notEmpty().withMessage("to is required").isEmail().withMessage("Indirizzo email non valido"),
    check("lng").optional().isIn(ALLOWED_MAIL_LNG).withMessage("Lingua non supportata"),
  ],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const baseType = req.body.type as string;
      const to = req.body.to as string;
      const lng = (req.body.lng as string) || "it";
      const effectiveType = buildMailType(baseType, lng);

      const clientUrl = process.env.CLIENT_URL || env.CLIENT_URL || "";
      const sampleVariables: Record<string, string> = {
        name: res.locals.userLogged?.details?.name || "Mario Rossi",
        pin: "123456",
        mail: to,
        email: to,
        password: "NuovaPassword123!",
        order_id: "TEST-ORDER-0001",
        amount: "99,00",
        payment_method: "Carta di credito",
        route: "Napoli — Pompei",
        title: "Email di test",
        body: "Questo è il corpo di prova dell'email di test.",
        img: clientUrl + "/assets/pintour-logo.png",
        url: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TEST-ORDER-0001",
        mytickets_url: clientUrl + "/user/mytickets",
      };

      const mailService = new MailService(db);
      const sent = await mailService.sendMail(
        new Mail({
          to: to,
          type: effectiveType,
          bodyVariables: sampleVariables,
        }),
      );

      if (sent) {
        res.json({ message: "Email di test inviata correttamente", type: effectiveType, to: to });
      } else {
        throw new ErrorModel(500, "Invio email fallito: controlla i log del server");
      }
    } catch (error: any) {
      logger.error("Errore invio email di test: " + (error?.message || error), res.locals.log);
      next(error);
    }
  },
);

router.post(
  "/mail/hello",
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  [check("to").notEmpty().withMessage("to is required").isEmail().withMessage("Indirizzo email non valido")],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const to = req.body.to as string;

      const mailService = new MailService(db);
      const sent = await mailService.sendMail(
        new Mail({
          to: to,
          type: "default",
          title: "Hello",
          message: "hello",
        }),
      );

      if (sent) {
        res.json({ message: "Email di test inviata correttamente", to: to });
      } else {
        throw new ErrorModel(500, "Invio email fallito: controlla i log del server");
      }
    } catch (error: any) {
      logger.error("Errore invio email di test (hello): " + (error?.message || error), res.locals.log);
      next(error);
    }
  },
);

export default router;
