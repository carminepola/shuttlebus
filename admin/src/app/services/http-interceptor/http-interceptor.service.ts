import { HttpInterceptorFn } from '@angular/common/http';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const modifiedReq = req.clone({
    withCredentials: true, // Aggiunge withCredentials a tutte le richieste
  });
  return next(modifiedReq);
};