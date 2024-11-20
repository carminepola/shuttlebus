import { NextFunction, Request, Response } from "express";
import MessageModel from "../model/messageModel";
import ErrorModel from "../model/errorModel";
import { logger } from "..";
export default function errorMiddleware(
  err: Error,
  req: Request,
  res: Response<MessageModel>,
  next: NextFunction
) {
  try {
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    res.status(statusCode);

    if (!res.locals.response) {
      res.locals.response = {};
    }
    res.locals.response.error = new ErrorModel(
      err.message,
      statusCode,
      err.stack
    );

    res.json(res.locals.response);
  } catch (error) {
    res.locals.log.error = error;
    logger.error(`Errore ${res.locals.response.uniqueCallKey}`, res.locals.log);
    next(error);
  }
}
