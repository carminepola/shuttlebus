import { ApplicationConfig, LOCALE_ID, inject, isDevMode, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http'; import { routes } from './app.routes';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import localeFr from '@angular/common/locales/fr';
import localeDe from '@angular/common/locales/de';
import localeEs from '@angular/common/locales/es';
import localeJa from '@angular/common/locales/ja';
import { appLocale } from './services/lng/locale';
import { AuthService } from './services/auth/auth.service';
import { appBootstrapSession, MeService } from './services/auth/me.service';
import { httpInterceptor } from './services/http-interceptor/http-interceptor.service';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(localeIt);
registerLocaleData(localeFr);
registerLocaleData(localeDe);
registerLocaleData(localeEs);
registerLocaleData(localeJa);

export const appConfig: ApplicationConfig = {
  providers: [
    // date e numeri nella lingua dell'utente (prima era sempre en-US: "12 November 2026")
    { provide: LOCALE_ID, useFactory: appLocale },
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
    // PWA: service worker solo in produzione; registrato quando l'app e' stabile
    // (o dopo 30s) per non rallentare il primo caricamento.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
