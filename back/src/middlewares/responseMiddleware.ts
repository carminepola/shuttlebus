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
      let statusCode = res.statusCode;
      if (statusCode >= 400 && statusCode <= 599) {


        if (statusCode >= 500 && statusCode <= 599) {
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

        Object.assign(res.locals.response, body);
        logger.info(
          `Richiesta completata`,
          res.locals.log
        );
      }


      if (res.locals.response.stack) {
        delete res.locals.response.stack;
      }

      res.removeHeader('Content-Security-Policy');
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
