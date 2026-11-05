import { NextFunction, Request, Response } from 'express';

import { db } from '../index';
import FailToBanServices from '../components/services/failToBanServices';

/**
 * 404 (path non gestito da nessuna route):
 *  - Solo i percorsi sotto /api contano come tentativo fallito in failToBan
 *    per IP: chi sonda endpoint inesistenti accumula tentativi e finisce nel
 *    lockout con backoff esponenziale su login/registrazione/MFA come un
 *    tentativo fallito. I 404 fuori da /api (asset mancanti, favicon, typo)
 *    NON contano per non penalizzare utenti reali.
 *  - Risposta minima via res.send (non res.json): bypassa il logger.warn del
 *    responseMiddleware, i probe non riempiono i log di warning.
 */
export default async function routeNotFoundMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const path = req.originalUrl || req.url || "";
    if (path.startsWith("/api")) {
      const failToBanServices = new FailToBanServices(db);
      await failToBanServices.insertIp(req.ip || req.socket.remoteAddress || "unknown");
    }
    res.status(404).send("Not found");
  } catch (error) {
    next(error);
  }
}
