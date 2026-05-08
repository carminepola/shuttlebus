import { NextFunction, Request, Response } from "express";
import MessageModel from "../model/messageModel";
import ErrorModel from "../model/errorModel";
import { logger } from "..";
import { env } from "process";
export default function errorMiddleware(err: any, req: Request, res: Response<MessageModel>, next: NextFunction) {
  try {
    if (!res.locals.response) {
      res.locals.response = {};
    }
    if (!res.locals.log) {
      res.locals.log = {} as any;
    }
    let error = undefined;
    if (err instanceof ErrorModel) {
      error = err;
    } else {
      error = new ErrorModel(500, err.message, err.stack);
    }
    res.locals.log.error = { ...error };
    res.status(error?.code || 500);

    if (error.code) {
      delete error.code;
    }
    if (error.stack && env.NODE_ENV != "DEV" && env.NODE_ENV != "TEST") {
      delete error.stack;
    }

    Object.assign(res.locals.response, error);

    res.json(error);
  } catch (error) {
    if (!res.locals.log) {
      res.locals.log = {} as any;
    }
    res.locals.log.error = error;
    logger.error(`Errore ${res.locals.response?.uniqueCallKey || "unknown"}`, res.locals.log);
    next(error);
  }
}
