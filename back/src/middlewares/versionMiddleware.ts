import { NextFunction, Request, Response } from "express";
import { logger } from "..";
/**
 * Crea un token univoco per ogni richiesta e lo inserisce
 * nella risposta
 * @param req richiesta
 * @param res risposta
 * @param next funzione successiva
 */
export default async function versionMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Estrae la versione dell'applicazione dal file package.json
    // Prova prima ../package.json (produzione/Docker), poi ../../package.json (sviluppo locale)
    let pjson: any;
    try {
      pjson = require("../package.json");
    } catch {
      pjson = require("../../package.json");
    }
    const appVersion = pjson.version || "Versione non trovata";

    // Assegna la versione alla risposta
    res.locals.response.version = appVersion;
    next();
  } catch (error) {
    // Logga l'errore e passa al middleware successivo
    logger.error("Errore in versionMiddleware: " + JSON.stringify(error));
    next(error);
  }
}
