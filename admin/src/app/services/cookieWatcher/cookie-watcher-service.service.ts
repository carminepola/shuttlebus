import { BehaviorSubject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Injectable, EventEmitter } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CookieWatcherServiceService {
  private cookieSubjects: { [key: string]: BehaviorSubject<string | null> } =
    {};
  public eventEmitter: EventEmitter<any> = new EventEmitter();
  private jwt: string = '';

  constructor(private authService: AuthService) {
    // Inizializza il BehaviorSubject per il JWT
    this.cookieSubjects['jwt'] = new BehaviorSubject<string | null>(
      this.authService.getDecodedToken()
    );
    this.jwt = this.authService.getToken();
  }

  // Funzione per osservare i cambiamenti del JWT
  watchCookie() {
    // Restituisce l'Observable esistente del JWT
    return this.cookieSubjects['jwt'].asObservable();
  }

  // Metodo per monitorare periodicamente il cookie per i cambiamenti
  startWatchingJwtChanges() {
    setInterval(() => {
      let currentJwt = this.authService.getToken();

      // Confronta solo se il JWT è cambiato
      if (this.jwt !== currentJwt) {
        this.jwt = currentJwt;

        // Emette il nuovo token decodificato quando cambia
        const decodedToken = this.authService.getDecodedToken();
        this.cookieSubjects['jwt'].next(decodedToken); // aggiorna il BehaviorSubject
        this.eventEmitter.emit(decodedToken); // notifica gli altri componenti
      }
    }, 500); // Controlla ogni secondo se il JWT è cambiato
  }
}
