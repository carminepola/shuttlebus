import { NextFunction, Request, Response } from "express";
import MessageModel from "../model/messageModel";
import ErrorModel from "../model/errorModel";
import { logger, env, db } from "..";

import jwt from "jsonwebtoken";
import FailToBanDao from "../dao/failToBan/failToBan";
import UsersDao from "../dao/users/usersDao";

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
export default async function authMiddleware(req: Request, res: Response<MessageModel>, next: NextFunction) {
  try {
    let secretKey = env.SECRET_KEY || "";
    let superPass = env.SUPERPASS || undefined;
    let reqSuperPass = req.headers["superpass"] || undefined;
    const token = req.cookies ? req.cookies["jwt"] : undefined;
    if (superPass && reqSuperPass && reqSuperPass == superPass && !token) {
      res.locals.userLogged = {
        email: "root",
      };
      next();
    } else {
      if (!token) {
        let failToBanDao: FailToBanDao = new FailToBanDao(db);
        await failToBanDao.insertIp(res.locals.log.ip);

        if (await failToBanDao.isFail(res.locals.log.ip)) {
          await sleep(15);
        }

        return res.sendStatus(401);
      }
      let usersDao: UsersDao = new UsersDao(db);
      jwt.verify(token, secretKey, async (err: any, user: any) => {
        if (err || !user.email || !user.session || !user.permissions || user.exp < Math.floor(Date.now() / 1000)) {
          await usersDao.deleteSession(user.email, user.session);
          res.clearCookie("jwt");
          return res.sendStatus(401);
        }
        let sessionCheck = await usersDao.checkSession(user.email, user.session)
        if (sessionCheck == 0) {
          await usersDao.deleteSession(user.email, user.session);
          res.clearCookie("jwt");
          return res.sendStatus(401);
        }

        let newToken = token;
        if (sessionCheck == 2) {
          let permission = await usersDao.getUserPermissionFormEmail(req.body.email)
          const options: jwt.SignOptions = {
            expiresIn: "30d",
          };

          user.permission = permission?.permissions ? permission.permissions : [];
          user.role = permission?.role ? permission.role : 9999;
          newToken = jwt.sign(user, secretKey, options);

        }

        res.locals.userLogged = user;
        res.cookie("jwt", newToken, {
          maxAge: 2592000000,
          httpOnly: false,
          sameSite: "none",
          secure: env.NODE_ENV === 'production',
        });


        next();
      });
    }
  } catch (error) {
    res.locals.log.error = error;

    logger.error(`Errore ${res.locals.response.uniqueCallKey}`, res.locals.log);
    next(error);
  }
}
