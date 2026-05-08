import { NextFunction, Request, Response } from "express";
import MessageModel from "../model/messageModel";
import ErrorModel from "../model/errorModel";
import { logger, db } from "..";
import express from "express";

export default async function responseMiddleware(req: Request, res: Response<MessageModel>, next: NextFunction) {
  try {
    const originalJson = res.json;

    res.json = function (body?: any): express.Response {
      let statusCode = res.statusCode;
      res.locals.log.status = res.statusCode;
      res.locals.log.response = res.locals.response;
      if (statusCode >= 400 && statusCode <= 599) {
        if (statusCode >= 500 && statusCode <= 599) {
          logger.error(`Richiesta completata`, res.locals.log);
        } else {
          logger.warn(`Richiesta completata`, res.locals.log);
        }
      } else {
        res.locals.log.body = body;

        Object.assign(res.locals.response, body);
        logger.info(`Richiesta completata`, res.locals.log);
      }

      if (res.locals.response.stack) {
        delete res.locals.response.stack;
      }

      res.removeHeader("Content-Security-Policy");
      return originalJson.call(this, res.locals.response);
    };

    next();
  } catch (error) {
    if (!res.locals.log) {
      res.locals.log = {} as any;
    }
    res.locals.log.error = error;
    logger.error(`Errore non gestito ${res.locals.response?.uniqueCallKey || "unknown"}`, res.locals.log);
    next(error);
  }
}
