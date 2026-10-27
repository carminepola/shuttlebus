import express, { CookieOptions } from "express";
import { cookieSameSite, cookieSecure } from "../cookiePolicy";
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
import MfaServices from "../components/services/mfaServices";
import { setSessionCookies } from "../utils/sessionCookies";
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

      // Login: verifica password + fail-to-ban basato su email
      // Se le credenziali sono errate, sessionServices.verifyCredentials() lancia ErrorModel(400)
      try {
        await sessionServices.verifyCredentials(email, req.body.password);
      } catch (loginError) {
        // Registra il fallimento anche per IP e logga server-side il contatore
        try {
          await failToBanServices.insertIp(clientIp);
          const state = await failToBanServices.getFailState(email);
          logger.warn(`Login fallito: email=${email} tentativi_falliti_account=${state.count}`);
        } catch (logError) {
          logger.error("Errore registrazione fallimento login", logError);
        }
        throw loginError;
      }

      // Login riuscito: azzera i contatori email e IP
      await failToBanServices.deleteIp(email);
      await failToBanServices.deleteIp(clientIp);

      // 2FA attivo: nessuna sessione finche' non arriva il secondo fattore
      const mfaChallenge = await new MfaServices(db).startLoginChallenge(email, !!req.body.rememberMe, false);
      if (mfaChallenge) {
        return res.json(mfaChallenge);
      }

      const loginResponse = await sessionServices.createUserSession(email, !!req.body.rememberMe);
      setSessionCookies(res, loginResponse, !!req.body.rememberMe);

      res.json({ message: "Accesso autorizzato" });
    } catch (error: ErrorModel | any) {
      next(error);
    }
  },
);

/** Reinvio del codice 2FA via email durante il login (ticket MFA nel body). */
router.post(
  "/mfa/email",
  authIpLimiter,
  [check("mfaToken").notEmpty().withMessage("mfaToken is required")],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mfaServices = new MfaServices(db);
      const ticket = mfaServices.readTicket(req.body.mfaToken);
      if (!(await mfaServices.getLoginMethods(ticket.userId)).includes("email")) {
        throw new ErrorModel(400, "Metodo non disponibile");
      }
      const user = await new UserServices(db).getUserByEmailAll(ticket.email);
      await mfaServices.sendEmailCode(ticket.userId, ticket.email, user?.options?.lng);
      res.json({ message: "Codice inviato" });
    } catch (error) {
      next(error);
    }
  },
);

/** Secondo fattore del login: codice app (totp), email o codice di recupero. Crea la sessione. */
router.post(
  "/mfa/verify",
  authIpLimiter,
  [
    check("mfaToken").notEmpty().withMessage("mfaToken is required"),
    check("method").isIn(["totp", "email", "recovery"]).withMessage("method non valido"),
    check("code").notEmpty().withMessage("code is required"),
  ],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const mfaServices = new MfaServices(db);
      const failToBanServices = new FailToBanServices(db);
      const ticket = mfaServices.readTicket(req.body.mfaToken);
      const failKey = `mfa:${ticket.userId}`;

      if (await failToBanServices.isRateLimited(failKey)) {
        throw new ErrorModel(429, "Troppi tentativi. Riprova più tardi.");
      }
      if (!(await mfaServices.verifySecondFactor(ticket.userId, req.body.method, String(req.body.code)))) {
        await failToBanServices.insertIp(failKey);
        logger.warn(`Codice 2FA errato per ${ticket.email} (metodo ${req.body.method})`);
        throw new ErrorModel(400, "Codice non valido");
      }
      await failToBanServices.deleteIp(failKey);

      const sessionServices = new SessionServices(db);
      // OAuth: stessa sessione di loginGoogle (sempre "ricordami"); password: createUserSession
      const loginResponse = ticket.oauth
        ? await sessionServices.loginGoogle(ticket.email)
        : await sessionServices.createUserSession(ticket.email, ticket.rememberMe);
      setSessionCookies(res, loginResponse, ticket.oauth || ticket.rememberMe);

      res.json({ message: "Accesso autorizzato" });
    } catch (error) {
      next(error);
    }
  },
);

/** Login con passkey, passo 1: challenge WebAuthn (credenziali individuabili). */
router.post("/passkey/options", authIpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await new MfaServices(db).passkeyLoginOptions());
  } catch (error) {
    next(error);
  }
});

/**
 * Login con passkey, passo 2: verifica asserzione e crea la sessione.
 * La passkey e' gia' un fattore forte (possesso + biometria/PIN): niente 2FA aggiuntivo.
 */
router.post(
  "/passkey/verify",
  authIpLimiter,
  [check("challengeId").notEmpty().withMessage("challengeId is required"), check("response").isObject().withMessage("response is required")],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const failToBanServices = new FailToBanServices(db);
      const clientIp = res.locals.log?.ip || req.ip;
      if (await failToBanServices.isRateLimited(clientIp)) {
        throw new ErrorModel(429, "Troppi tentativi. Riprova più tardi.");
      }
      let email: string;
      try {
        email = await new MfaServices(db).passkeyLoginVerify(req.body.challengeId, req.body.response);
      } catch (error) {
        await failToBanServices.insertIp(clientIp);
        throw error;
      }
      const rememberMe = !!req.body.rememberMe;
      const loginResponse = await new SessionServices(db).createUserSession(email, rememberMe);
      setSessionCookies(res, loginResponse, rememberMe);
      res.json({ message: "Accesso autorizzato" });
    } catch (error) {
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
  // pentest: VIA solo i token/payload grezzi OAuth; le foto di profilo RESTANO
  // (l'avatar google/microsoft e' usato da navbar/sidebar dell'area admin).
  if (options?.google) {
    delete options.google._raw;
    delete options.google._json;
    delete options.google.accessToken;
    delete options.google.refreshToken;
  }
  if (options?.microsoft) {
    delete options.microsoft._raw;
    delete options.microsoft._json;
    delete options.microsoft.accessToken;
    delete options.microsoft.refreshToken;
  }
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
