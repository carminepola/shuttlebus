import express, { CookieOptions } from "express";
import { db, logger, env } from "../index";
import bcrypt from "bcrypt";
import UserDao from "../dao/users/usersDao";
import { check, validationResult } from "express-validator"; // Aggiuntoimport { error } from "console";
import ErrorModel from "../model/errorModel";
import { exitCode } from "process";
import { Request, Response, NextFunction } from "express";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import jwt from "jsonwebtoken";
import FailToBanDao from "../dao/failToBan/failToBan";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.post(
  "/",
  [check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"), check("password").notEmpty().withMessage("password is required")],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {

      let secretKey = env.SECRET_KEY || "";
      let result = {};
      let userDao = new UserDao(db, res.locals.log);
      let failToBan = new FailToBanDao(db);
      const token = req.cookies ? req.cookies["jwt"] : undefined;
      if (token) {
        let valid = true;
        jwt.verify(token, secretKey, (err: any, user: any) => {
          if (!err) {
            valid = false;
          }
        });
        if (!valid) {
          res.locals.customErrorMessage = "Utente già autenticato";
          return res.sendStatus(409);
        }
      }

      if (await userDao.checkPassword(req.body.email, req.body.password)) {
        failToBan.deleteIp(res.locals.log.ip);

        let seessionToken = await userDao.createSession(req.body.email)
        let user = await userDao.readUserByEmail(req.body.email)
        let session = {
          ...user,
          rememberMe: req.body.rememberMe || false,
          session: seessionToken.newSession,
          email: req.body.email,
          role: user?.role >= 0 && user?.role != undefined && user?.role != null ? user.role : 9999,
          permissions: user?.permissions ? user.permissions : [],
        };


        let token: any = jwt.sign(session, secretKey, {
          expiresIn: "3h",
        });

        let refreshToken: any = jwt.sign({
          refreshToken: seessionToken.refreshToken

        }, secretKey, {
          expiresIn: "30d",
        });
        let settingsJwt: CookieOptions =
        {
          maxAge: undefined,
          httpOnly: false,
          sameSite: env.NODE_ENV === 'production' ? "none" : "strict",
          secure: env.NODE_ENV === 'production',
        }
        if (req.body.rememberMe) {
          settingsJwt.maxAge = 2592000000
          res.cookie("refreshToken", refreshToken, {
            maxAge: 2592000000,
            httpOnly: true,
            sameSite: env.NODE_ENV === 'production' ? "none" : "strict",

            secure: env.NODE_ENV === 'production',
          });
        }


        res.cookie("jwt", token, settingsJwt);



        result = { message: "Accesso autorizzato" };
      } else {
        failToBan.insertIp(res.locals.log.ip);
        res.locals.customErrorMessage = "Credenziali non valide. Riprova.";
        return res.sendStatus(401);

      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
router.delete("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let result = {};


    let userDao = new UserDao(db, res.locals.log);
    let ris = await userDao.deleteSession(res.locals.userLogged.email, res.locals.userLogged.session);
    res.clearCookie("jwt");
    res.clearCookie("refreshToken");
    if (ris == 0) {

      res.locals.customErrorMessage = "Nessuna sessione trovata";
      return res.sendStatus(404);

    }
    else {
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

    let userDao = new UserDao(db, res.locals.log);
    await userDao.deleteAllExceptCurrentSession(res.locals.userLogged.email, res.locals.userLogged.session);
    result = { message: "Tutte le sessioni cancellate eccetto quella in uso" };

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
