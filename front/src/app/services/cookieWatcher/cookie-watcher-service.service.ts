import { BehaviorSubject } from 'rxjs';
import { MeService, SessionUser } from '../auth/me.service';
import { AuthService } from '../auth/auth.service';
import { Injectable, EventEmitter } from '@angular/core';

/**
 * Monitora i cambi dell'identita' corrente.
 * Il cookie jwt e' httpOnly: non si puo' piu' "spiare" il valore via JS,
 * quindi la fonte e' l'endpoint server-side /auth/me (vedi MeService).
 */
@Injectable({
  providedIn: 'root',
})
export class CookieWatcherServiceService {
  private sessionSubject = new BehaviorSubject<SessionUser | null>(null);
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  public eventEmitter: EventEmitter<SessionUser | null> = new EventEmitter();

  constructor(
    private authService: AuthService,
    private meService: MeService
  ) {
    this.sessionSubject.next(this.meService.session());
  }

  // Funzione per osservare i cambiamenti dell'identita'
  watchCookie() {
    return this.sessionSubject.asObservable();
  }

  // Metodo per monitorare periodicamente lo stato di autenticazione
  startWatchingJwtChanges() {
    if (this.pollInterval) return;
    this.polling = false;
    this.pollInterval = setInterval(() => {
      if (this.polling) return;
      this.polling = true;
      this.meService.refresh().finally(() => {
        this.polling = false;
        const current = this.meService.session();
        const previous = this.sessionSubject.value;
        const changed = JSON.stringify(current) !== JSON.stringify(previous);
        if (changed) {
          this.sessionSubject.next(current);
          this.eventEmitter.emit(current);
        }
      });
    }, 5000);
  }

  /** Rimuove il poller (per i test). */
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      this.polling = false;
    }
  }
}
