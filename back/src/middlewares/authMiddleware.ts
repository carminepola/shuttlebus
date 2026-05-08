import { NextFunction, Request, Response } from "express";
import MessageModel from "../model/messageModel";

import { logger, env, db } from "..";
import { CookieOptions } from "express";
import jwt from "jsonwebtoken";
import FailToBanDao from "../components/dao/failToBan";
import UsersDao from "../components/dao/usersDao";

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function verifyJwt(token: string, secret: string, options?: jwt.VerifyOptions): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, options || {}, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
}

export default async function authMiddleware(req: Request, res: Response<MessageModel>, next: NextFunction) {
  try {
    const secretKey = env.SECRET_KEY!;
    const token = req.cookies?.jwt;
    const refreshToken = req.cookies?.refreshToken;

    if (!token) {
      const failToBanDao = new FailToBanDao(db);
      await failToBanDao.insertIp(res.locals.log.ip);
      if (await failToBanDao.isFail(res.locals.log.ip)) {
        await sleep(15);
      }
      res.clearCookie("refreshToken");
      return res.sendStatus(401);
    }

    const usersDao = new UsersDao(db);

    let user: any;
    try {
      user = await verifyJwt(token, secretKey, { ignoreExpiration: true });
    } catch (error) {
      res.clearCookie("jwt");
      res.clearCookie("refreshToken");
      return res.sendStatus(401);
    }

    if (user.exp < Math.floor(Date.now() / 1000)) {
      if (!refreshToken) {
        await usersDao.deleteSession(user.email, user.session);
        res.clearCookie("jwt");
        res.clearCookie("refreshToken");
        return res.sendStatus(401);
      }

      let decodedRefresh: any;
      try {
        decodedRefresh = await verifyJwt(refreshToken, secretKey);
      } catch (error) {
        await usersDao.deleteSession(user.email, user.session);
        res.clearCookie("jwt");
        res.clearCookie("refreshToken");
        return res.sendStatus(401);
      }

      const validRefreshToken = await usersDao.checkRefreshTokenAndSession(user.email, decodedRefresh.refreshToken, user.session);
      if (!validRefreshToken) {
        await usersDao.deleteSession(user.email, user.session);
        res.clearCookie("jwt");
        res.clearCookie("refreshToken");
        return res.sendStatus(401);
      }

      const newRefreshToken = jwt.sign({ refreshToken: decodedRefresh.refreshToken }, secretKey, {
        expiresIn: "30d",
      });
      res.cookie("refreshToken", newRefreshToken, {
        maxAge: 2592000000,
        httpOnly: true,
        secure: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST",
        sameSite: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST" ? "none" : "strict",
      });
    }

    const sessionCheck = await usersDao.checkSession(user.email, user.session);
    if (sessionCheck === 0) {
      await usersDao.deleteSession(user.email, user.session);
      res.clearCookie("jwt");
      res.clearCookie("refreshToken");
      return res.sendStatus(401);
    }
    if (sessionCheck == 2) {
      const permission = await usersDao.getUserPermissionsFormEmail(user.email);
      user.permissions = permission?.permissions || [];

      user.role = permission?.role >= 0 && permission?.role != undefined && permission?.role != null ? permission.role : 9999;
      user.options = permission?.options || {};
      user.details = permission?.details || {};

      await usersDao.setFalseUserPermissions(user.email, user.session);
    }
    delete user.exp;
    delete user.iat;
    delete user.options?.pin;

    let newToken = jwt.sign(user, secretKey, {
      expiresIn: "72h",
    });

    res.locals.userLogged = user;
    let settingsJwt: CookieOptions = {
      maxAge: 2592000000,
      httpOnly: false,
      secure: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST",
      sameSite: env.NODE_ENV === "PROD" || env.NODE_ENV === "TEST" ? "none" : "strict",
    };
    if (!user.rememberMe) {
      settingsJwt.maxAge = undefined;
    }
    res.clearCookie("jwt", { path: "/" });
    res.cookie("jwt", newToken, settingsJwt);

    return next();
  } catch (error) {
    res.locals.log.error = error;
    logger.error(`Errore ${res.locals.response.uniqueCallKey}`, res.locals.log);
    return next(error);
  }
}
