import { NextFunction, Request, Response } from "express";
import { logger } from "..";
import ErrorModel from "../model/errorModel";

// Middleware per loggare ogni volta che viene inviato un status
export function logSendStatusMiddleware(req: Request, res: Response, next: NextFunction) {
    // Salva il riferimento originale del metodo sendStatus
    const originalSendStatus = res.sendStatus;

    // Sovrascrivi il metodo sendStatus
    res.sendStatus = function (statusCode: number) {
        // Logga il codice di stato prima di inviarlo


        // Crea il corpo della risposta come oggetto JSON

        res.locals.response.error = new ErrorModel(statusCode, res.locals.customErrorMessage);
        // Invia il JSON con il codice di stato
        delete res.locals.customErrorMessage;
        return res.status(statusCode).json({});
    };

    // Passa al middleware successivo
    next();
}
