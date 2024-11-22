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

    res.status(500);

    if (!res.locals.response) {
      res.locals.response = {};
    }


    res.locals.response.error = new ErrorModel(

      500, err.message, err.stack)




    res.json({});
  } catch (error) {
    res.locals.log.error = error;
    logger.error(`Errore ${res.locals.response.uniqueCallKey}`, res.locals.log);
    next(error);
  }
}
