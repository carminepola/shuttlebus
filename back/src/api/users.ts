import express from "express";
import { db, logger } from "../index";

import UserServices from "../components/services/userServices";
import { check } from "express-validator";

import ErrorModel from "../model/errorModel";

import { Request, Response, NextFunction } from "express";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import authMiddleware from "../middlewares/authMiddleware";
import userModel from "../model/userModel";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import MailService from "../components/services/mailServices";
import { Mail } from "../model/mailModel";
import { authIpLimiter, authAccountLimiter } from "../middlewares/authRateLimitMiddleware";
import FailToBanServices from "../components/services/failToBanServices";
const router = express.Router();
let requiredRole = "USER_MANAGEMENT";

router.get("/email/:email", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userServices = new UserServices(db);
    let email = req.params.email;
    const result = await userServices.getUserByEmail(email);
    res.json(result);
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.post(
  "/register",
  authIpLimiter,
  authAccountLimiter,
  [
    check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"),
    check("password")
      .notEmpty()
      .withMessage("password is required")
      .isLength({ min: 8 })
      .withMessage("La password deve avere almeno 8 caratteri")
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage("La password deve contenere almeno una lettera e un numero"),
    check("name").notEmpty().withMessage("name is required"),
  ],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let user: userModel = new userModel();
      let language = req.body.lng;
      user.email = req.body.email;
      user.password = req.body.password;
      user.details.name = req.body.name;
      user.details.phone = req.body.phoneNumber;
      user.role = role.NO_PERMISSION;
      user.disabled = false;
      user.options.lng = language;
      user.privacyAndPolicy = true;
      user.privacyAndPolicyConfirmDate = new Date().getTime();

      let userServices = new UserServices(db);
      try {
        await userServices.register(user, language);
      } catch (regError: any) {
        // pentest: veniva restituito 409 "Utente gia' esistente" permettendo a chiunque
        // di ENUMERARE gli account registrati. Non si rivelera' piu' nulla: la risposta
        // e' sempre identica, l'email di verifica parte solo se l'account e' davvero nuovo.
        if (regError?.code === 409 || String(regError?.message || "").includes("esistente")) {
          logger.warn(`Tentativo di registrazione su account esistente (enumerazione bloccata): ${user.email}`);
        } else {
          throw regError;
        }
      }

      res.json({ message: "Registrazione effettuata con successo" });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);

router.post(
  "/validateEmail",
  // pentest: PIN a 6 cifre brute-forceabile: 35 richieste senza mai un 429.
  // Stesso trattamento degli endpoint di login: limiter per-IP e per-account.
  authIpLimiter,
  authAccountLimiter,
  [check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"), check("pin").notEmpty().withMessage("pin is required").isNumeric().withMessage("pin must be a number")],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let email = String(req.body.email).toLowerCase();
      let pin = req.body.pin;

      let userServices = new UserServices(db);
      try {
        await userServices.validateEmail(email, pin);
      } catch (err: any) {
        // PIN errato: registra il fallimento per l'account (anti-bruteforce)
        if (err?.code === 400) {
          const failToBanServices = new FailToBanServices(db);
          await failToBanServices.insertIp(`pin:${email}`);
          const state = await failToBanServices.getFailState(`pin:${email}`);
          if (state.count >= 10) {
            // Bruteforce in corso (10 PIN errati in finestra): il PIN va nullato.
            // L'utente dovra' richiedere una nuova email di verifica.
            await userServices.clearPendingPin(email);
            logger.warn(`PIN di ${email} invalidato dopo ${state.count} tentativi errati`);
          }
          // messaggio generico: non si rivelano dettagli sullo stato
          throw new ErrorModel(400, "Pin non valido");
        }
        throw err;
      }

      res.json({ message: "Email validata con successo" });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);
router.post(
  "/",
  [
    check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"),
    check("password")
      .notEmpty()
      .withMessage("password is required")
      .isLength({ min: 8 })
      .withMessage("La password deve avere almeno 8 caratteri")
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage("La password deve contenere almeno una lettera e un numero"),
    check("name").notEmpty().withMessage("name is required"),
  ],
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, [requiredRole]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let result: any;
      let user: userModel = new userModel();
      user.email = req.body.email;
      user.password = req.body.password;
      user.details.name = req.body.name;
      if (req.body.phone) {
        user.details.phone = req.body.phone;
      }
      user.role = role.USER;

      let userServices = new UserServices(db);
      let oldUser = await userServices.getUserByEmail(user.email);
      if (oldUser) {
        res.locals.customErrorMessage = "Utente già esistente";
        return res.sendStatus(409);
      } else {
        result = await userServices.createUser(user);
        res.locals.response.object = result;
      }
      res.json(result);
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);

router.patch(
  "/changePassword",
  [
    check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"),
    check("password")
      .notEmpty()
      .withMessage("password is required")
      .isLength({ min: 8 })
      .withMessage("La password deve avere almeno 8 caratteri")
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage("La password deve contenere almeno una lettera e un numero"),
    check("oldPassword").notEmpty().withMessage("oldPassword is required"),
  ],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let result: any;
      let user = {
        email: res.locals.userLogged.email,
        password: req.body.password,
        oldPassword: req.body.oldPassword,
        // N-08: la sessione che esegue il cambio e' l'UNICA che sopravvive;
        // tutte le altre (rubate, dispositivi vecchi) vengono revocate a valle.
        session: res.locals.userLogged.session,
      };

      let userServices = new UserServices(db);

      result = await userServices.changePassword(user);
      res.json(result);
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);

router.patch(
  "/updateDetails",
  [check("name").notEmpty().withMessage("name is required"), check("phone").optional().isString().withMessage("phone must be a string")],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let email = res.locals.userLogged.email;
      let userServices = new UserServices(db);

      const result = await userServices.updateUserDetails(email, req.body.name, req.body.phone);
      res.json({ message: "Dettagli aggiornati con successo", user: result });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);

router.patch(
  "/updateRole",
  [check("userId").notEmpty().withMessage("userId is required"), check("role").notEmpty().withMessage("role is required").isNumeric().withMessage("role must be a number")],
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, [requiredRole]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let userServices = new UserServices(db);
      const result = await userServices.updateRole(req.body.userId, parseInt(req.body.role));
      res.json({ message: "Ruolo aggiornato con successo", ...result });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);

router.patch(
  "/updateUserDetails",
  [check("userId").notEmpty().withMessage("userId is required"), check("name").notEmpty().withMessage("name is required"), check("phone").optional().isString().withMessage("phone must be a string")],
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, [requiredRole]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let userServices = new UserServices(db);
      const result = await userServices.updateUserDetailsById(req.body.userId, req.body.name, req.body.phone);
      res.json({ message: "Dettagli utente aggiornati con successo", user: result });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);

router.get("/getNormalUser", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userServices = new UserServices(db);
    const result = await userServices.getNormalUser();
    res.json({ listUser: result });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let email = res.locals.userLogged.email;
    let userServices = new UserServices(db);
    const result = await userServices.getUserByEmailAll(email);
    // pentest: la risposta conteneva `sessions` con i GUID refreshToken (30 giorni!):
    // qualsiasi leak di questi endpoint = hijack della sessione. Nessun refreshToken
    // deve mai lasciare il server.
    const safeUser: any = { ...(result || {}) };
    delete safeUser.password;
    delete safeUser.recoverPassword;
    delete safeUser.recoverPasswordCount;
    delete safeUser.sessions;
    delete safeUser.options?.pin;
    delete safeUser.options?.google?._raw;
    delete safeUser.options?.google?._json;
    res.json(safeUser);
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.get("/search", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    let userServices = new UserServices(db);
    const result = await userServices.searchStaff(searchTerm, page, limit);
    res.json(result);
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.get("/clients", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    let userServices = new UserServices(db);
    const result = await userServices.searchUsers(searchTerm, page, limit);
    res.json(result);
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.get("/no-permission", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    let userServices = new UserServices(db);
    const result = await userServices.getNoPermissionUsers(searchTerm, page, limit);
    res.json(result);
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.put(
  "/updateOptions",
  [check("options").notEmpty().withMessage("options is required").isObject().withMessage("options must be an object"), check("options.*").exists().withMessage("options must not be empty")],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let result: any;

      console.log("options");
      let email = res.locals.userLogged.email;
      let userServices = new UserServices(db);

      let options: { [key: string]: string } = req.body.options;

      for (const key in options) {
        if (options.hasOwnProperty(key)) {
          const value = options[key];
          result = await userServices.updateOptions(email, key, value);
        }
      }

      return res.status(205).json({ message: "Opzioni aggiornate con successo" });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);
router.delete("/:id", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userServices = new UserServices(db);
    const id = req.params.id;
    await userServices.deleteUserById(id);
    res.json({ message: "Utente eliminato con successo" });
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.get("/:id?", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userServices = new UserServices(db);
    let id = req.params.id ? req.params.id : undefined;
    if (id) {
      const result = await userServices.getUserById(id);
      res.json(result);
    } else {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await userServices.getStaff(page, limit);
      res.json(result);
    }
  } catch (error) {
    logger.error(error);
    next(error);
  }
});
export default router;
