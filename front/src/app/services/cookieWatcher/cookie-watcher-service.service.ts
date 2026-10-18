import { Subscription, startWith } from 'rxjs';
import { MeService, SessionUser } from '../auth/me.service';
import { Injectable, EventEmitter } from '@angular/core';

/**
 * Monitora i cambi dell'identita' corrente.
 * Il cookie jwt e' httpOnly: non si puo' piu' "spiare" il valore via JS,
 * quindi la fonte e' l'endpoint server-side /auth/me (vedi MeService).
 *
 * NON fa polling: ascolta gli EVENTI di cambiamento emessi da MeService
 * (login, logout, 401/403 via interceptor) e aggiorna lo stato solo
 * quando la tab torna visibile/dopo lo focus (throttle, max 1 chiamata/min):
 * un admin puo' revocare/aggiornare permessi mentre l'utente ha la pagina aperta.
 */
@Injectable({
  providedIn: 'root',
})
export class CookieWatcherServiceService {
  private started = false;
  private lastFetch = 0;
  public eventEmitter: EventEmitter<SessionUser | null> = new EventEmitter();
  private subscription: Subscription | null = null;

  // Intervallo minimo tra due /auth/me tirati da visibility/focus
  private static readonly REFRESH_MIN_GAP_MS = 60 * 1000;

  constructor(private meService: MeService) {}

  // Osserva i cambiamenti dell'identita': emette il valore corrente
  // alla sottoscrizione (startWith) e poi ogni evento di cambio.
  watchCookie() {
    return this.meService
      .sessionChanges()
      .pipe(startWith(this.meService.session()));
  }

  /**
   * Registra gli event listener (visibilitychange / focus, throttlati) e
   * inoltra ogni cambiamento di identita' emesso da MeService.
   * Chiamata una sola volta da AppComponent.
   */
  startWatchingJwtChanges() {
    if (this.started) return;
    this.started = true;

    // Al ritorno sulla tab/focus: un SINGOLO /auth/me (throttle di 1 minuto)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onActivity);
      window.addEventListener('focus', this.onActivity);
    }
  }

  private onActivity = () => {
    const now = Date.now();
    if (document.visibilityState === 'hidden') return;
    if (now - this.lastFetch < CookieWatcherServiceService.REFRESH_MIN_GAP_MS) return;
    this.lastFetch = now;
    this.meService.refresh();
  };

  /** Rispcrizione esplicita agli eventi (per chi preferisce non usare watchCookie). */
  subscribeEvents(next: (user: SessionUser | null) => void): Subscription {
    return this.meService
      .sessionChanges()
      .pipe(startWith(this.meService.session()))
      .subscribe({ next });
  }

  /** Rimuove i listener e l'iscrizione (per i test). */
  stop() {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onActivity);
      window.removeEventListener('focus', this.onActivity);
    }
    this.started = false;
  }
}
