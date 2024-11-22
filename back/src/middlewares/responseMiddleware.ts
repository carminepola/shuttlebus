import { NextFunction, Request, Response } from "express";
import MessageModel from "../model/messageModel";
import ErrorModel from "../model/errorModel";
import { logger } from "..";
import express from "express";

export default function responseMiddleware(
  req: Request,
  res: Response<MessageModel>,
  next: NextFunction
) {
  try {
    const originalJson = res.json;

    res.json = function (body?: any): express.Response {
      if (res.locals.response.error) {
        res.status(res.locals.response.error.code);
        res.locals.log.error = res.locals.response.error;

        if (res.locals.response.error.code == 500) {
          logger.error(
            `Richiesta completata`,
            res.locals.log
          );
        }
        else {
          logger.warn(
            `Richiesta completata`,
            res.locals.log
          );
        }
      } else {
        res.locals.log.body = body;

        res.locals.response.object = body;
        logger.info(
          `Richiesta completata`,
          res.locals.log
        );
      }


      if (res.locals.response.error && res.locals.response.error.stack) {
        delete res.locals.response.error.stack;
      }


      return originalJson.call(this, res.locals.response);
    };

    next();
  } catch (error) {
    res.locals.log.error = error;
    logger.error(
      `Errore non gestito ${res.locals.response.uniqueCallKey}`,
      res.locals.log
    ); // Modifica questa riga in base alle tue esigenze
    next(error);
  }
}
