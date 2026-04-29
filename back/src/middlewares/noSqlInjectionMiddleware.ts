import { NextFunction, Request, Response } from 'express';
import CallRequestModel from '../model/callRequestModel';
import { logger, env } from '..';
import jwt from 'jsonwebtoken';
import ErrorModel from '../model/errorModel';
export default function requestMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (checkForNoSQLInjection(req.body)) {
      throw new ErrorModel(400, 'No Sql injection');
    }

    next();
  } catch (error) {
    next(error);
  }
}

function checkForNoSQLInjection(payload: any) {
  try {
    if (Array.isArray(payload)) {
      for (let i = 0; i < payload.length; i++) {
        if (checkForNoSQLInjection(payload[i])) {
          return true;
        }
      }
    } else if (typeof payload === 'object') {
      // se payload è un oggetto, elenco tutte le chiavi e iteriamo su di esse
      const keys = Object.keys(payload);
      for (let i = 0; i < keys.length; i++) {
        // se una delle chiavi comincia con $ o il valore della chiave
        // contiene una NoSQL injection, restituisco true
        if (keys[i].startsWith('$') || checkForNoSQLInjection(payload[keys[i]])) {
          return true;
        }
      }
    }
    // se è un tipo base, escludo la possibilità di NoSQL injection
    return false;
  } catch (error) {
    logger.error('Errore in checkForNoSQLInjection: ');
    return false;
  }


}
