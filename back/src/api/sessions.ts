import express from "express";
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
import { role } from "../enum/role";
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
        jwt.verify(token, secretKey, (err: any, user: any) => {
          if (!err) {
            res.locals.response.error = new ErrorModel("Utente già autenticato", 409);
            return;
          }
        });
      }

      if (await userDao.checkPassword(req.body.email, req.body.password)) {
        failToBan.deleteIp(res.locals.log.ip);
        let permission = await userDao.getUserPermissionFormEmail(req.body.email)
        let session = {
          session: await userDao.createSession(req.body.email),
          email: req.body.email,
          role: permission?.role >= 0 && permission?.role != undefined && permission?.role != null ? permission.role : 9999,
          permissions: permission?.permissions ? permission.permissions : [],
        };

        const options: jwt.SignOptions = {
          expiresIn: "30d",
        };

        let token: any = jwt.sign(session, secretKey, options);

        res.cookie("jwt", token, {
          maxAge: 2592000000,
          httpOnly: false,
          secure: env.NODE_ENV === 'production',
        });

        result = { message: "Login riuscito" };
      } else {
        failToBan.insertIp(res.locals.log.ip);
        res.locals.response.error = new ErrorModel("Utente non autorizzato", 401);
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
    if (ris == 0) {

      res.locals.response.error = new ErrorModel("Sessione non trovata", 404);

    }
    else {
      result = { message: "Logout riuscito" };
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
