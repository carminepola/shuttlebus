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
        // Only jwt can be deleted via JS (not httpOnly).
        // refreshToken is httpOnly and will be cleared server-side on next request.
        authService.deleteCookie('jwt');
        const currentUrl = router.url;
        if (
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
