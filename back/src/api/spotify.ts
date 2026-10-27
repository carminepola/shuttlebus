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
import GoogleSessionServices from "../components/services/googleSessionsServices"; // handshake provider-agnostico (collection googleSessions)
import FailToBanServices from "../components/services/failToBanServices";

const router = express.Router();

// Reindirizza l'utente a Spotify per il login
// Guardia: provider non configurato (env assenti) -> redirect al login, non 500.
router.get("/auth", (req: Request, res: Response) => {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return res.redirect("/login");
  }
  passport.authenticate("spotify", { scope: ["user-read-email", "user-read-private"] })(req, res, () => undefined);
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
    const handshakeServices = new GoogleSessionServices(db);
    const sessionServices = new SessionServices(db);

    let spSession = await handshakeServices.readGoogleSessionByToken(id);
    if (spSession) {
      failToBanServices.deleteIp(req.ip);
      // 2FA attivo: la sessione nasce solo dopo il secondo fattore (POST /auth/mfa/verify)
      const mfaChallenge = await new MfaServices(db).startLoginChallenge(spSession, true, true);
      if (mfaChallenge) {
        return res.json(mfaChallenge);
      }
      let loginResponse = await sessionServices.loginGoogle(spSession);
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

// Callback dopo il login su Spotify
// Il codice di autorizzazione OAuth e' MONOUSO: un refresh o un back del browser
// sulla callback ripropone un codice gia' consumato -> TokenError
// "Invalid authorization code". Passport instrada l'errore a error() (500),
// ignorando failureRedirect: qui viene intercettato e convertito in redirect al
// login, cosi' l'utente riparte con un flusso pulito invece della pagina di errore.
router.get("/auth/callback", (req: any, res: Response, next: NextFunction) => {
  passport.authenticate("spotify", (err: any, user: any) => {
    if (err) {
      // err.oauthError contiene statusCode/body della risposta del provider
      // (es. "failed to fetch user profile" senza dettagli senza questo campo).
      logger.warn(
        `Login Spotify: autenticazione fallita (${err.message || "errore OAuth"}${
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
  const email = req.user.emails?.[0]?.value || req.user._json?.email || "";
  if (!email) {
    logger.warn("Login Spotify: email non disponibile nel profilo");
    return res.redirect("/login");
  }

  const photo = req.user.photos?.[0]?.value || "";
  user.email = email;
  user.details.name = req.user.displayName || req.user.username || "";
  user.options.spotify = {
    photos: photo ? [{ value: photo }] : [],
    email: email,
    displayName: req.user.displayName || user.details.name,
    id: req.user.id || req.user._json?.id || "",
  };

  user.role = role.USER;
  user.disabled = false;

  const userServices = new UserServices(db);

  const handshakeServices = new GoogleSessionServices(db);

  let userExists = await userServices.getUserByEmailAll(user.email);

  if (!userExists) {
    await userServices.createUser(user);
  } else {
    await userServices.updateOAuthInfo(user.email, "spotify", user.options.spotify);
    if (userExists.role === role.NO_PERMISSION) {
      await userServices.updateRoleByEmail(user.email, role.USER);
    }
  }

  let spotifySession = await handshakeServices.insertGoogleSession(user.email);

  return res.redirect(`${url}/auth/${spotifySession}`);
});

export default router;
