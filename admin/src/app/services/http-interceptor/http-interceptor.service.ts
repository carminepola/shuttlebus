import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';
import { HttpResponse } from '@angular/common/http';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';
export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const modifiedReq = req.clone({
    withCredentials: true, // Aggiunge withCredentials a tutte le richieste
  });
  const authService = inject(AuthService);
  const router = inject(Router)
  return next(modifiedReq).pipe(
    // Usa tap per controllare la risposta
    tap({
      next: (event) => {
        // Verifica se la risposta è un HttpResponse e se lo status è 204
        if (event instanceof HttpResponse && event.status === 205) {
          authService.refreshToken().subscribe();
        }
        if (event instanceof HttpResponse && event.status === 401) {
          router
            .navigate(['/not-authorized'])
            .then(() => {

            })

        }

      },
    })
  );
};
