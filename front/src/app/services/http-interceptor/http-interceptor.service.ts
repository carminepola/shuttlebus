import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const modifiedReq = req.clone({
    withCredentials: true,
  });

  const router = inject(Router);
  const authService = inject(AuthService);

  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 || error.status === 403) {
        // Il cookie jwt e' httpOnly: la "cancellazione" via JS non serve piu'.
        // Invalida lo stato in memoria e lascia la revoca dei cookie al server.
        authService.clearSession();

        const silent = modifiedReq.headers.has('x-silent-auth');
        const currentUrl = router.url;
        if (
          !silent &&
          !currentUrl.includes('/not-authorized') &&
          !currentUrl.includes('/too-many-requests')
        ) {
          router.navigate(['/not-authorized']);
        }
      }

      if (error.status === 429) {
        const currentUrl = router.url;
        if (!currentUrl.includes('/too-many-requests')) {
          router.navigate(['/too-many-requests']);
        }
      }

      return throwError(() => error);
    }),
  );
};
