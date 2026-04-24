import express, { CookieOptions } from "express";
import passport from "passport";

import UserServices from "../components/services/userServices";
import { role } from "../enum/role";
import userModel from "../model/userModel";
import { db, env, logger } from "../index";
import SessionServices from "../components/services/sessionServices";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import GoogleSessionServices from "../components/services/googleSessionsServices";
const router = express.Router();
import FailToBanServices from "../components/services/failToBanServices";
// Reindirizza l'utente a Google per il login
router.get(
  "/auth",
  passport.authenticate("google", {
    scope: ["profile", "email", "https://www.googleapis.com/auth/user.phonenumbers.read"],
  }),
);

router.get("/getSession/:id", async (req: any, res: Response, next: NextFunction) => {
  try {
    let secretKey = env.SECRET_KEY || "";

    const failToBanServices = new FailToBanServices(db);

    if (await failToBanServices.isFail(req.ip)) {
      return res.status(429).json({ error: "Troppi tentativi. Riprova più tardi." });
    }

    await failToBanServices.insertIp(req.ip);
    let id = req.params.id;
    const googleSessionsServices = new GoogleSessionServices(db);

    const sessionServices = new SessionServices(db);
    let gSession = await googleSessionsServices.readGoogleSessionByToken(id);
    if (gSession) {
      failToBanServices.deleteIp(req.ip);
      let loginResponse = await sessionServices.loginGoogle(gSession);
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
        maxAge: undefined,
        httpOnly: false,
        sameSite: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST" ? "none" : "strict",
        secure: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST",
      };

      settingsJwt.maxAge = 2592000000;
      res.cookie("jwt", token, settingsJwt);
      res.cookie("refreshToken", refreshToken, {
        maxAge: 2592000000,
        httpOnly: true,
        sameSite: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST" ? "none" : "strict",
        secure: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST",
      });

      res.json({ message: "Accesso autorizzato" });
    } else {
      res.status(401).json({ error: "Token non valido o scaduto" });
    }
  } catch (error) {
    next(error);
  }
});
// Callback dopo il login su Google
router.get("/auth/callback", passport.authenticate("google", { failureRedirect: "/login" }), async (req: any, res: Response) => {
  if (!req.user) return res.redirect("/login");
  let url = env.CLIENT_URL;

  const user = new userModel();
  user.email = req.user.emails[0].value;
  user.details.name = req.user.displayName;
  user.options.google = { photos: [{ value: req.user.photos[0].value }], email: req.user.emails[0].value, displayName: req.user.displayName, id: req.user.id };

  user.role = role.USER;
  user.disabled = false;

  const userServices = new UserServices(db);

  const googleSessionServices = new GoogleSessionServices(db);

  let userExists = await userServices.getUserByEmailAll(user.email);

  if (!userExists) {
    userServices.createUser(user);
  } else {
    userServices.updateGoogleInfo(user.email, user.options.google);
  }

  let googleSession = await googleSessionServices.insertGoogleSession(user.email);

  // L'utente è autenticato, puoi creare un token JWT e inviarlo al frontend
  return res.redirect(`${url}/auth/${googleSession}`);
});

export default router;
