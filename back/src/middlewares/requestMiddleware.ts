import { NextFunction, Request, Response } from 'express';
import CallRequestModel from '../model/callRequestModel';
import { logger, env } from '..';
import jwt from 'jsonwebtoken';
export default function requestMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let secretKey = env.SECRET_KEY || '';
    let ipAddress = req.socket.remoteAddress || '';
    let xforwardedfor = req.headers['x-forwarded-for'] || undefined;
    let xrealip = req.headers['x-real-ip'] || '';

    if (xforwardedfor) {
      let listIp = xforwardedfor.toString().split(',');
      ipAddress = listIp[listIp.length - 1];
    }
    if (xrealip) {
      ipAddress = xrealip.toString();
    }

    const method = req.method;
    const url = req.url;
    const headers = req.headers;
    const token = req.cookies ? req.cookies.jwt : undefined;

    const clientSid = req.cookies ? req.cookies['connect.sid'] : undefined;
    let session = '';
    jwt.verify(token, secretKey, (err: any, user: any) => {
      if (!err) {
        session = user.session;
      }
    });

    // Log della richiesta
    let log = new CallRequestModel(clientSid, ipAddress, res.locals.response.uniqueCallKey, method, url, headers, res.locals.response.version, res.locals.response.clientCallKey, session);
    res.locals.log = log;
    // Se la richiesta ha un corpo (ad es. POST), loggiamolo
    if (req.body) {
      log.body = req.body;
    }

    logger.info('Nuova richiesta', log);
    next();
  } catch (error) {
    logger.info('Errrore in requestMiddleware:', error);
    next(error);
  }
}
