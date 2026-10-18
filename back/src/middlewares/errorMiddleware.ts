import { NextFunction, Request, Response } from "express";
import MessageModel from "../model/messageModel";
import ErrorModel from "../model/errorModel";
import { logger } from "..";

/**
 * Errori dei body parser (body-parser): NON rilanciare mai
 * message/stack originali (contengono percorsi di node_modules).
 */
function mapParserError(err: any): ErrorModel | null {
  switch (err?.type) {
    case "entity.parse.failed":
      return new ErrorModel(400, "str_error_bad_request");
    case "entity.verify.failed":
      return new ErrorModel(400, "str_error_bad_request");
    case "entity.too.large":
      return new ErrorModel(413, "str_error_payload_too_large");
    case "request.aborted":
      return new ErrorModel(400, "str_error_bad_request");
    default:
      return null;
  }
}

export default function errorMiddleware(err: any, req: Request, res: Response<MessageModel>, next: NextFunction) {
  try {
    if (!res.locals.response) {
      res.locals.response = {};
    }
    if (!res.locals.log) {
      res.locals.log = {} as any;
    }
    let error: ErrorModel;
    if (err instanceof ErrorModel) {
      error = err;
    } else if (mapParserError(err)) {
      error = mapParserError(err)!;
    } else {
      // Errori NON di dominio (RuntimeError, driver, librerie...): NON esporre
      // ne' message ne' stack nella risposta (nessun leak di path/stack/librerie).
      // Solo i messaggi a chiave di traduzione ("str_*") vengono preservati.
      const code = typeof err?.status === "number" && err.status >= 400 && err.status < 500 ? err.status : 500;
      const message = typeof err?.message === "string" && err.message.startsWith("str_") ? err.message : "Something went wrong";
      error = new ErrorModel(code, message);
    }
    // Log server-side COMPLETO (con stack): winston/rail di risposta, mai al client
    res.locals.log.error = { ...error, stack: err?.stack };
    res.status(error?.code || 500);

    if (error.code) {
      delete error.code;
    }
    if (error.stack) {
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
