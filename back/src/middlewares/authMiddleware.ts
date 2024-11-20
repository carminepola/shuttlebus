import { NextFunction, Request, Response } from "express";
import MessageModel from "../model/messageModel";
import ErrorModel from "../model/errorModel";
import { logger, env, mongo } from "..";

import jwt from "jsonwebtoken";
import FailToBanDao from "../dao/failToBan/failToBan";
import UsersDao from "../dao/user/userDao";
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
        username: "root",
      };
      next();
    } else {
      if (!token) {
        let failToBanDao: FailToBanDao = new FailToBanDao(mongo.getDb());
        await failToBanDao.insertIp(res.locals.log.ip);

        if (await failToBanDao.isFail(res.locals.log.ip)) {
          await sleep(15);
        }

        return res.sendStatus(401);
      }
      let users: UsersDao = new UsersDao(mongo.getDb());
      jwt.verify(token, secretKey, async (err: any, user: any) => {
        if (err || !user.username || !user.session || !(await users.checkSession(user.username, user.session))) {
          res.clearCookie("jwt");
          return res.sendStatus(401);
        } else {
          res.locals.userLogged = user;
          res.cookie("jwt", token, {
            maxAge: 86400000,
            httpOnly: true,
            sameSite: "none",
            secure: false,
          });
          next();
        }
      });
    }
  } catch (error) {
    res.locals.log.error = error;
    logger.error(`Errore ${res.locals.response.uniqueCallKey}`, res.locals.log);
    next(error);
  }
}
