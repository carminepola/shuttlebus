import { NextFunction, Request, Response } from "express";
import CallRequestModel from "../model/callRequestModel";
import { logger, env } from "..";
import jwt from "jsonwebtoken";

// Header sensibili da non loggare
const SENSITIVE_HEADERS = ["cookie", "authorization", "superpass"];

// Campi del body sensibili da mascherare
const SENSITIVE_BODY_FIELDS = ["password", "oldPassword", "pin", "recoverPassword"];

function sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
  const sanitized = { ...headers };
  for (const key of SENSITIVE_HEADERS) {
    if (sanitized[key]) {
      sanitized[key] = "***";
    }
  }
  return sanitized;
}

function sanitizeBody(body: any): any {
  if (!body || typeof body !== "object") {
    return body;
  }
  if (Array.isArray(body)) {
    return body.map((item) => sanitizeBody(item));
  }
  const sanitized = { ...body };
  for (const key of SENSITIVE_BODY_FIELDS) {
    if (sanitized[key] !== undefined) {
      sanitized[key] = "***";
    }
  }
  return sanitized;
}

export default function requestMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let secretKey = env.SECRET_KEY!;
    // pentest: prima venivano letti X-Forwarded-For/X-Real-IP GREZZI (spoofabili da
    // chiunque: "stampigliava" l'IP nei log aggirando flag/rate-limit). Ora si usa
    // req.ip: con trust proxy attivo risolve l'IP client SOLO se l'ultimo hop e'
    // il reverse proxy fidato (nginx proxy manager).
    let ipAddress = req.ip || req.socket.remoteAddress || "";

    const method = req.method;
    const url = req.url;
    // Sanitizza gli header prima di loggarli (rimuove cookie, authorization)
    const headers = sanitizeHeaders(req.headers);
    const token = req.cookies ? req.cookies["jwt"] : undefined;

    const clientSid = req.cookies ? req.cookies["connect.sid"] : undefined;
    let session = "";
    jwt.verify(token, secretKey, (err: any, user: any) => {
      if (!err) {
        session = user.session;
      }
    });

    // Log della richiesta
    let log = new CallRequestModel(clientSid, ipAddress, res.locals.response.uniqueCallKey, method, url, headers, res.locals.response.version, res.locals.response.clientCallKey, session);
    res.locals.log = log;
    // Se la richiesta ha un corpo (ad es. POST), loggiamolo sanificato
    if (req.body) {
      log.body = sanitizeBody(req.body);
    }

    logger.info(`Nuova richiesta`, log);
    next();
  } catch (error) {
    logger.info("Errrore in requestMiddleware:", error);
    next(error);
  }
}
