import express, { CookieOptions } from "express";
import { cookieSameSite, cookieSecure } from "../cookiePolicy";
import passport from "passport";

import UserServices from "../components/services/userServices";
import { role } from "../enum/role";
import userModel from "../model/userModel";
import { db, env, logger } from "../index";
import SessionServices from "../components/services/sessionServices";
import MfaServices from "../components/services/mfaServices";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import GoogleSessionServices from "../components/services/googleSessionsServices";
const router = express.Router();
import FailToBanServices from "../components/services/failToBanServices";

// Reindirizza l'utente a Microsoft per il login
// Guardia: provider non configurato (env assenti) -> redirect al login, non 500.
router.get("/auth", (req: Request, res: Response) => {
  if (
    !process.env.MICROSOFT_CLIENT_ID ||
    !process.env.MICROSOFT_CLIENT_SECRET ||
    !process.env.MICROSOFT_CALLBACK_URL
  ) {
    return res.redirect("/login");
  }
  passport.authenticate("microsoft", { scope: ["user.read"] })(req, res, () => undefined);
});

router.get("/getSession/:id", async (req: any, res: Response, next: NextFunction) => {
  try {
    let secretKey = env.SECRET_KEY || "";

    const failToBanServices = new FailToBanServices(db);

    if (await failToBanServices.isFail(req.ip)) {
      return res.status(429).json({ error: "Troppi tentativi. Riprova più tardi." });
    }

    await failToBanServices.insertIp(req.ip);
    let id = req.params.id;
    const microsoftSessionsServices = new GoogleSessionServices(db);

    const sessionServices = new SessionServices(db);
    let mSession = await microsoftSessionsServices.readGoogleSessionByToken(id);
    if (mSession) {
      failToBanServices.deleteIp(req.ip);
      // 2FA attivo: la sessione nasce solo dopo il secondo fattore (POST /auth/mfa/verify)
      const mfaChallenge = await new MfaServices(db).startLoginChallenge(mSession, true, true);
      if (mfaChallenge) {
        return res.json(mfaChallenge);
      }
      let loginResponse = await sessionServices.loginGoogle(mSession);
      let sessionToken = loginResponse.sessionToken;
      let userSession = loginResponse.userSession;
      let token: any = jwt.sign(userSession, secretKey, {
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
        maxAge: 2592000000,
        // Il JWT NON e' leggibile dal JavaScript (mitigazione furto via XSS):
        // l'identita' lato front passa dall'endpoint GET /auth/me.
        httpOnly: true,
        sameSite: cookieSameSite(),
        secure: cookieSecure(),
      };

      res.cookie("jwt", token, settingsJwt);
      res.cookie("refreshToken", refreshToken, {
        maxAge: 2592000000,
        httpOnly: true,
        sameSite: cookieSameSite(),
        secure: cookieSecure(),
      });

      res.json({ message: "Accesso autorizzato" });
    } else {
      res.status(401).json({ error: "Token non valido o scaduto" });
    }
  } catch (error) {
    next(error);
  }
});

// Callback dopo il login su Microsoft
// Il codice di autorizzazione OAuth e' MONOUSO: un refresh o un back del browser
// sulla callback ripropone un codice gia' consumato -> TokenError. Passport
// instrada l'errore a error() (500), ignorando failureRedirect: qui viene
// intercettato e convertito in redirect al login.
router.get("/auth/callback", (req: any, res: Response, next: NextFunction) => {
  passport.authenticate("microsoft", (err: any, user: any) => {
    if (err) {
      logger.warn(
        `Login Microsoft: autenticazione fallita (${err.message || "errore OAuth"}${
          err.oauthError?.statusCode ? ` - HTTP ${err.oauthError.statusCode}` : ""
        })`,
      );
      return res.redirect("/login");
    }
    if (!user) return res.redirect("/login");
    req.user = user;
    next();
  })(req, res, next);
}, async (req: any, res: Response) => {
  if (!req.user) return res.redirect("/login");
  let url = env.CLIENT_URL;

  const user = new userModel();
  const email = req.user.emails?.[0]?.value || req.user._json?.mail || req.user._json?.userPrincipalName || "";
  if (!email) {
    logger.error("Login Microsoft: nessuna email trovata nel profilo");
    return res.redirect("/login");
  }

  const photo = req.user.photos?.[0]?.value || "";
  user.email = email;
  user.details.name = req.user.displayName || req.user._json?.displayName || "";
  user.options.microsoft = {
    photos: photo ? [{ value: photo }] : [],
    email: email,
    displayName: user.details.name,
    id: req.user.id || req.user._json?.id || "",
  };

  user.role = role.USER;
  user.disabled = false;

  const userServices = new UserServices(db);

  const sessionServices = new GoogleSessionServices(db);

  let userExists = await userServices.getUserByEmailAll(user.email);

  if (!userExists) {
    await userServices.createUser(user);
  } else {
    await userServices.updateMicrosoftInfo(user.email, user.options.microsoft);
    if (userExists.role === role.NO_PERMISSION) {
      await userServices.updateRoleByEmail(user.email, role.USER);
    }
  }

  let microsoftSession = await sessionServices.insertGoogleSession(user.email);

  // L'utente è autenticato, reindirizza al frontend con il token di sessione
  return res.redirect(`${url}/auth/${microsoftSession}`);
});

export default router;
