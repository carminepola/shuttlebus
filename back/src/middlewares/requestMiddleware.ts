import { NextFunction, Request, Response } from "express";
import CallRequestModel from "../model/callRequestModel";
import { logger } from "..";

export default function requestMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let ipAddress = req.socket.remoteAddress || "";
    let xforwardedfor = req.headers["x-forwarded-for"] || undefined;
    let xrealip = req.headers["x-real-ip"] || "";

    if (xforwardedfor) {
      let listIp = xforwardedfor.toString().split(",");
      ipAddress = listIp[listIp.length - 1];
    }
    if (xrealip) {
      ipAddress = xrealip.toString();
    }

    const method = req.method;
    const url = req.url;
    const headers = req.headers;

    // Log della richiesta
    let log = new CallRequestModel(ipAddress, res.locals.response.uniqueCallKey, method, url, headers, res.locals.response.version, res.locals.response.clientCallKey);
    res.locals.log = log;
    // Se la richiesta ha un corpo (ad es. POST), loggiamolo
    if (req.body) {
      log.body = req.body;
    }

    logger.info(`Richiesta ${res.locals.response.uniqueCallKey}`, log);
    next();
  } catch (error) {
    logger.info("Errrore in requestMiddleware:", error);
    next(error);
  }
}
