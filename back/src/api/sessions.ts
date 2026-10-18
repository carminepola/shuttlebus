import express, { CookieOptions } from "express";
import { db, logger, env } from "../index";
import bcrypt from "bcrypt";
import UserDao from "../components/dao/usersDao";
import { check, validationResult } from "express-validator";
import ErrorModel from "../model/errorModel";

import { Request, Response, NextFunction } from "express";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import jwt from "jsonwebtoken";
import authMiddleware from "../middlewares/authMiddleware";

import UserServices from "../components/services/userServices";
import FailToBanServices from "../components/services/failToBanServices";
import SessionServices from "../components/services/sessionServices";
import BookingsServices from "../components/services/bookingServices";
import { authIpLimiter, authAccountLimiter } from "../middlewares/authRateLimitMiddleware";
const router = express.Router();

router.post(
  "/",
  authIpLimiter,
  authAccountLimiter,
  [check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"), check("password").notEmpty().withMessage("password is required")],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let secretKey = env.SECRET_KEY!;

      // Verifica se l'utente è già autenticato
      const token = req.cookies ? req.cookies["jwt"] : undefined;
      if (token) {
        let valid = true;
        jwt.verify(token, secretKey, (err: any, user: any) => {
          if (!err) {
            valid = false;
          }
        });
        if (!valid) {
          throw new ErrorModel(409, "Utente già autenticato");
        }
      }

      let sessionServices = new SessionServices(db);
      let failToBanServices = new FailToBanServices(db);

      const clientIp = res.locals.log?.ip || req.ip;
      const email = String(req.body.email || "").toLowerCase();

      // Lockout con backoff esponenziale: per-account (email) E per-IP
      if ((await failToBanServices.isRateLimited(email)) || (await failToBanServices.isRateLimited(clientIp))) {
        logger.warn(`Login bloccato per rate limiting: email=${email} ip=${clientIp}`);
        throw new ErrorModel(429, "Troppi tentativi. Riprova più tardi.");
      }

      // Login: verifica password + crea sessione + fail-to-ban basato su email
      // Se le credenziali sono errate, sessionServices.login() lancia ErrorModel(400)
      let loginResponse;
      try {
        loginResponse = await sessionServices.login(email, req.body.password, req.body.rememberMe);
      } catch (loginError) {
        // Registra il fallimento anche per IP e logga server-side il contatore
        try {
          await failToBanServices.insertIp(clientIp);
          const state = await failToBanServices.getFailState(email);
          logger.warn(`Login fallito: email=${email} ip=${clientIp} tentativi_falliti_account=${state.count}`);
        } catch (logError) {
          logger.error("Errore registrazione fallimento login", logError);
        }
        throw loginError;
      }

      // Login riuscito: azzera i contatori email e IP
      await failToBanServices.deleteIp(email);
      await failToBanServices.deleteIp(clientIp);

      let sessionToken = loginResponse.sessionToken;
      let userSession = loginResponse.userSession;

      let jwtToken: any = jwt.sign(userSession, secretKey, {
        expiresIn: "72h",
      });

      let refreshToken: any = jwt.sign(
        {
          refreshToken: sessionToken.refreshToken,
        },
        secretKey,
        {
          expiresIn: "30d",
        },
      );
      let settingsJwt: CookieOptions = {
        maxAge: undefined,
        // Il JWT NON e' leggibile dal JavaScript (mitigazione furto via XSS):
        // l'identita' lato front passa dall'endpoint GET /auth/me, non dal cookie.
        httpOnly: true,
        sameSite: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST" ? "none" : "strict",
        secure: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST",
      };
      if (req.body.rememberMe) {
        settingsJwt.maxAge = 2592000000;
        res.cookie("refreshToken", refreshToken, {
          maxAge: 2592000000,
          httpOnly: true,
          sameSite: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST" ? "none" : "strict",
          secure: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST",
        });
      }

      res.cookie("jwt", jwtToken, settingsJwt);

      res.json({ message: "Accesso autorizzato" });
    } catch (error: ErrorModel | any) {
      next(error);
    }
  },
);
router.delete("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let result = {};

    let bookingsServices = new BookingsServices(db);
    let userId = res.locals.userLogged._id;
    let pendingBookings = await bookingsServices.getBookingFromUser(userId);

    if (pendingBookings && pendingBookings.length > 0) {
      for (let booking of pendingBookings) {
        if (booking.status === "pending") {
          await bookingsServices.deleteBooking(booking.numberOfTickets, userId);
        }
      }
    }

    let userServices = new UserServices(db);
    let ris = await userServices.deleteSession(res.locals.userLogged.email, res.locals.userLogged.session);
    res.clearCookie("jwt");
    res.clearCookie("refreshToken");
    if (!ris) {
      throw new ErrorModel(404, "Nessuna sessione trovata");
    } else {
      result = { message: "Logout riuscito" };
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});
router.delete("/all", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let result = {};

    let userDao = new UserDao(db);
    await userDao.deleteAllExceptCurrentSession(res.locals.userLogged.email, res.locals.userLogged.session);
    result = { message: "Tutte le sessioni cancellate eccetto quella in uso" };

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// pentest: lo stub rispondeva 200 "User upgraded" senza fare nulla.
// L'endpoint non e' piu' usato dal front (sessione interamente via cookie + /auth/me).
router.get("/refreshToken", authMiddleware, (req: Request, res: Response) => {
  res.status(410).json({ message: "Endpoint deprecato: la sessione si rinnova automaticamente via cookie" });
});

router.patch("/terms", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  let result = {};
  let userServices = new UserServices(db);

  userServices.acceptTerms(res.locals.userLogged["_id"]);

  result = { message: "User upgraded" };
  res.json(result);
});
router.post("/recoverPassword", authIpLimiter, authAccountLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userDao = new UserDao(db);
    let email = req.body.email;
    let lng = req.body.lng ? (req.body.lng == "it" ? "it" : "en") : "en";
    let user = await userDao.getUserByEmail(email);
    if (user) {
      // Genera un TOKEN OPACO a scadenza (mai password in chiaro via email):
      // la mail contiene solo un link con il token, usabile una sola volta.
      await userDao.insertRecoverPassword(user.email, user.details.name, lng);
    }
    res.json({ message: "Un link per reimpostare la password è stato inviato all'indirizzo email" });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/resetPassword",
  authIpLimiter,
  authAccountLimiter,
  [
    check("token").notEmpty().withMessage("token is required"),
    check("password")
      .notEmpty()
      .withMessage("password is required")
      .isLength({ min: 8 })
      .withMessage("Password di almeno 8 caratteri")
      .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
      .withMessage("La password deve contenere almeno una lettera e un numero"),
  ],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let userDao = new UserDao(db);
      const email = await userDao.consumeRecoverPasswordToken(String(req.body.token || ""), String(req.body.password || ""));
      if (!email) {
        // Token mancante, scaduto o gia' utilizzato: stesso messaggio generico
        throw new ErrorModel(400, "str_reset_token_invalid");
      }
      // Le sessioni attive dell'utente vengono revocate dalla rotazione del token
      logger.info(`Password reimpostata via token per ${email}: sessioni attive revocate`);
      res.json({ message: "str_reset_password_ok" });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/me", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  // Identita' della sessione corrente: il front NON legge piu' il cookie jwt via JS
  // (ora httpOnly) ma riceve i claim decodificati da authMiddleware (res.locals).
  const user = res.locals.userLogged;
  // options senza PIN (dati sensibili) - serve al front per il tema UI
  let options = { ...(user?.options || {}) } as any;
  delete options?.pin;
  delete options?.google;
  delete options?.microsoft;
  res.json({
    user: {
      _id: user?._id,
      email: user?.email,
      name: user?.details?.name || user?.name || "",
      role: user?.role,
      permissions: user?.permissions || [],
      session: user?.session,
      rememberMe: !!user?.rememberMe,
      options,
      details: {
        name: user?.details?.name || "",
        phone: user?.details?.phone || "",
      },
    },
  });
});

export default router;
