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
import { MAIL_TYPES, isMailType } from "../mail/mailTypes";
import { languageCodes } from "../i18n/languages";

// NOTE: le rotte echo di debug (GET / e POST /) sono state RIMOSE (pentest):
// restano solo le rotte mail di test, protette da authMiddleware + role.ADMIN.

/** Tipi di mail standard (pagina admin Test email). */
router.get("/mail/types", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]), (req: Request, res: Response) => {
  res.json({ types: Object.keys(MAIL_TYPES) });
});

router.post(
  "/mail",
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  [
    check("type").notEmpty().withMessage("type is required").custom((v) => isMailType(v)).withMessage("Tipo di email non consentito"),
    check("to").notEmpty().withMessage("to is required").isEmail().withMessage("Indirizzo email non valido"),
    check("lng")
      .optional()
      .custom(async (v) => (await languageCodes(db)).includes(v))
      .withMessage("Lingua non configurata"),
  ],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.body.type as keyof typeof MAIL_TYPES;
      const to = req.body.to as string;
      const lng = req.body.lng as string | undefined;
      // variabili d'esempio del tipo ({siteUrl} diventa CLIENT_URL nel layout)
      const sample: Record<string, string> = { ...MAIL_TYPES[type].sample, mail: to };
      if (sample.name) sample.name = res.locals.userLogged?.details?.name || sample.name;

      const mailService = new MailService(db);
      const sent = await mailService.sendMail(new Mail({ to, type, lng, bodyVariables: sample }));

      if (sent) {
        res.json({ message: "Email di test inviata correttamente", type, lng, to });
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
