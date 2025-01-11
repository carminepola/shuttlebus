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
/**
 * Middleware per l'autenticazione
 * Controlla se l'utente  ha fatto il login e se il token  valido
 * @param req richiesta
 * @param res risposta
 * @param next funzione successiva
 */
export default async function authMiddleware(req: Request, res: Response<MessageModel>, next: NextFunction) {
  try {
    // Retrieve secret key and super pass from environment variables
    const secretKey = env.SECRET_KEY || "";
    const superPass = env.SUPERPASS || undefined;
    const reqSuperPass = req.headers["superpass"] || undefined;
    const token = req.cookies?.jwt;
    const refreshToken = req.cookies?.refreshToken;

    // Allow access if super pass matches and there's no token
    if (superPass && reqSuperPass && reqSuperPass === superPass && !token) {
      res.locals.userLogged = {
        email: "root",
      };
      return next();
    }

    // If no token is present, log the IP and potentially delay response
    if (!token) {
      const failToBanDao = new FailToBanDao(db);
      await failToBanDao.insertIp(res.locals.log.ip);
      if (await failToBanDao.isFail(res.locals.log.ip)) {
        await sleep(15);
      }
      return res.sendStatus(401);
    }

    const usersDao = new UsersDao(db);

    // Verify JWT token
    await jwt.verify(token, secretKey, { ignoreExpiration: true }, async (err: any, user: any) => {
      try {
        if (err) {
          throw err.message;
        }
        if (user.exp < Math.floor(Date.now() / 1000)) {
          if (refreshToken) {
            try {
              // Verify refresh token
              await jwt.verify(refreshToken, secretKey, async (err: any, token: any) => {
                if (err) {
                  await usersDao.deleteSession(user.email, user.session);
                  res.clearCookie("jwt");
                  res.clearCookie("refreshToken");
                  return res.sendStatus(401);
                }

                // Check if refresh token and session are valid
                const validRefreshToken = await usersDao.checkRefreshTokenAndSession(user.email, token.refreshToken, user.session);
                if (!validRefreshToken) {
                  await usersDao.deleteSession(user.email, user.session);
                  res.clearCookie("jwt");
                  res.clearCookie("refreshToken");
                  return res.sendStatus(401);
                }

                // Issue new refresh token
                const newRefreshToken = jwt.sign({ refreshToken: token.refreshToken }, secretKey, {
                  expiresIn: "30d",
                });
                res.cookie("refreshToken", newRefreshToken, {
                  maxAge: 2592000000,
                  httpOnly: true,
                  secure: env.NODE_ENV === "production",
                  sameSite: "none",
                });
              });
            } catch (error) {
              res.locals.log.error = error;
              logger.error(`Errore ${res.locals.response.uniqueCallKey}`, res.locals.log);
              return next(error);
            }
          } else {
            await usersDao.deleteSession(user.email, user.session);
            res.clearCookie("jwt");
            res.clearCookie("refreshToken");
            return res.sendStatus(401);
          }
        }
        // Check if session is valid
        const sessionCheck = await usersDao.checkSession(user.email, user.session);
        if (sessionCheck === 0) {
          await usersDao.deleteSession(user.email, user.session);
          res.clearCookie("jwt");
          res.clearCookie("refreshToken");
          return res.sendStatus(401);
        }
        if (sessionCheck === 2) {
          // Refresh user permissions and roles from database
          const permission = await usersDao.getUserPermissionsFormEmail(user.email);
          user.permissions = permission?.permissions || [];
          user.role = permission?.role || 9999;
        }
        delete user.exp;
        delete user.iat;

        let newToken = jwt.sign(user, secretKey, {
          expiresIn: "3h",
        });
        // Set user information in response locals and set new token

        res.locals.userLogged = user;
        let settingsJwt: CookieOptions = {
          maxAge: 2592000000,
          httpOnly: false,
          secure: env.NODE_ENV === "production",
          sameSite: "none",
        };
        if (!user.rememberMe) {
          settingsJwt.maxAge = undefined;
        }

        res.cookie("jwt", newToken, settingsJwt);

        return next();
      } catch (error) {
        res.locals.log.error = error;
        logger.error(`Errore ${res.locals.response.uniqueCallKey}`, res.locals.log);
        return next(error);
      }
    });
  } catch (error) {
    // Log any errors and pass to next middleware
    res.locals.log.error = error;
    logger.error(`Errore ${res.locals.response.uniqueCallKey}`, res.locals.log);
    return next(error);
  }
}
