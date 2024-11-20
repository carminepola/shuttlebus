
 
import { NextFunction, Request, Response } from 'express';
 
export default function routeNotFoundMiddleware(req: Request, res: Response, next: NextFunction) {
   
 
  res.status(404); 
  const error = new Error('Pagina non trovata',res.locals.log);   
  next(error);
}
