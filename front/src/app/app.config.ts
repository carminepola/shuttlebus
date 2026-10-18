import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http'; import { routes } from './app.routes';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import { AuthService } from './services/auth/auth.service';
import { appBootstrapSession, MeService } from './services/auth/me.service';
import { httpInterceptor } from './services/http-interceptor/http-interceptor.service';
import { provideAnimations } from '@angular/platform-browser/animations';

registerLocaleData(localeIt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    // Il cookie jwt e' httpOnly: l'identita' viene caricata da GET /auth/me
    // PRIMA del bootstrap, cosi' guard e navbar leggono lo stato corretto.
    provideAppInitializer(() => {
      const meService = inject(MeService);
      return appBootstrapSession(meService)();
    }),
    provideHttpClient(withXhr(), withInterceptors([httpInterceptor])),
    AuthService,
    provideAnimations(),
  ],
};
