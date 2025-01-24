import { Injectable } from '@angular/core';
import {
  CanActivate,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): boolean {
    let user = this.authService.getDecodedToken();
    if (!user) {
      this.router.navigate(['/not-authorized']);
      return false;
    }

    let havePermission = true;
    if (route.data?.['requiredPermissions']) {
      havePermission = user.permissions.some((permission: string) =>
        route.data['requiredPermissions'].includes(permission)
      );
    }
    let haveRole = true;
    if (route.data?.['requiredRole']) {
      haveRole = user.role <= route.data['requiredRole'];
    }

    if (route.routeConfig?.data?.['requiredPermissions']) {
      havePermission = user.permissions.some((permission: string) =>
        route.routeConfig?.data
          ? ['requiredPermissions'].includes(permission)
          : false
      );
    }
    if (route.routeConfig?.data?.['requiredRole']) {
      haveRole = user.role <= route.routeConfig.data['requiredRole'];
    }

    if (haveRole && havePermission) {
      return true;
    } else {
      this.router.navigate(['/not-authorized']);
      return false;
    }
  }
}
