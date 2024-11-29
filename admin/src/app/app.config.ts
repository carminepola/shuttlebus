import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http'; import { routes } from './app.routes';
import { AuthService } from './services/auth/auth.service';
import { httpInterceptor } from './services/http-interceptor/http-interceptor.service';
import { provideAnimations } from '@angular/platform-browser/animations';
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([httpInterceptor])),
    AuthService,
    provideAnimations(),
  ],
};
