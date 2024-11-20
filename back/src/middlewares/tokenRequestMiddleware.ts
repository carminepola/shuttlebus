import { NextFunction, Request, Response } from "express";
import MessageModel from "../model/messageModel";
import { Guid } from "guid-typescript";
import { logger } from "..";

/**
 * Crea un token univoco per ogni richiesta e lo inserisce
 * nella risposta
 * @param req richiesta
 * @param res risposta
 * @param next funzione successiva
 */
export default function tokenRequestMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Crea un token univoco
    const uniqueCallKey = Guid.create().toString();
    // Inserisce il token nella risposta
    res.locals.response = new MessageModel(uniqueCallKey, req.headers.clientcallkey?.toString());
    // Chiama la funzione successiva
    next();
  } catch (error) {
    // se va in errore logga l'errore e chiama la funzione successiva
    logger.error("Errore in tokenRequestMiddleware: " + JSON.stringify(error), res.locals.log);
    next(error);
  }
}
