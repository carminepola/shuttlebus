import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap, catchError, throwError } from 'rxjs';
import { HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const modifiedReq = req.clone({
    withCredentials: true, // Aggiunge credenziali a tutte le richieste
  });

  const authService = inject(AuthService);
  const router = inject(Router);

  return next(modifiedReq).pipe(
    tap({
      next: (event: any) => {
        if (event instanceof HttpResponse) {
          console.log('Interceptor - Risposta ricevuta:', event.status);
        }

        if (event instanceof HttpResponse && event.status === 205) {
          authService.refreshToken().subscribe();
        }

        if (event instanceof HttpResponse && event.status === 401) {
          router.navigate(['/not-authorized']);
        }
      },
    }),
    catchError((error: HttpErrorResponse) => {
      console.error('Interceptor - Errore HTTP:', error);

      if (error.status === 401) {
        router.navigate(['/not-authorized']);
      }

      return throwError(() => error);
    })
  );
};
