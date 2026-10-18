
 
import { NextFunction, Request, Response } from 'express';
 
export default function routeNotFoundMiddleware(req: Request, res: Response, next: NextFunction) {
   
 
  const error = new Error('Pagina non trovata') as Error & { status: number };
  error.status = 404;
  next(error);
}
