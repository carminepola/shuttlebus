import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { firstValueFrom, Observable, Subject, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';

/**
 * Utente di sessione ricevuto da GET /api/auth/me.
 * Il cookie jwt e' httpOnly: il frontend NON lo legge piu' via JavaScript,
 * qui arrivano i claim decodificati a monte da authMiddleware (res.locals).
 */
export interface SessionUser {
  _id: string;
  email: string;
  name: string;
  role: number;
  permissions: string[];
  session: string;
  rememberMe: boolean;
  options?: any;
  details?: {
    name?: string;
    phone?: string;
  };
}

/**
 * Store dell'identita' corrente, alimentato SOLO dall'endpoint server-side /auth/me.
 * I componenti leggono il signal in modo sincrono: l'app si inizializza
 * con provideAppInitializer(appBootstrapSession) cosi' guard e template
 * hanno gia' lo stato pronto al primo render.
 */
@Injectable({
  providedIn: 'root',
})
export class MeService {
  private apiUrl = environment.apiUrl;
  private path = 'auth';

  private userSignal = signal<SessionUser | null>(null);
  private loading: Promise<SessionUser | null> | null = null;
  /** Emite l'utente (o null) a OGNI cambio di identita' (evento, non polling). */
  private sessionChangedSubject = new Subject<SessionUser | null>();

  constructor(private http: HttpClient) {}

  /** Utente corrente (null se non autenticato). */
  session(): SessionUser | null {
    return this.userSignal();
  }

  /** Stesso shape del vecchio jwt decodificato, per i componenti esistenti. */
  get decodedToken(): SessionUser | null {
    return this.userSignal();
  }

  isLoggedIn(): boolean {
    return this.userSignal() !== null;
  }

  /**
   * Scarica (o ri-scarica) l'identita' dal server. Header 'x-silent-auth':
   * evita il redirect pagina not-authorized quando l'utente semplicemente
   * non ha ancora effettuato il login.
   */
  refresh(): Promise<SessionUser | null> {
    if (this.loading) {
      return this.loading;
    }
    this.loading = firstValueFrom(
      this.http.get<{ user: SessionUser | null }>(
        `${this.apiUrl}/${this.path}/me`,
        {
          headers: { 'x-silent-auth': '1' },
        }
      )
    )
      .then((res) => {
        const user = res?.user ?? null;
        this.set(user);
        return user;
      })
      .catch(() => {
        this.set(null);
        return null;
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  /** Variante observable per i flows post-login. */
  refresh$(): Observable<SessionUser | null> {
    return this.http
      .get<{ user: SessionUser | null }>(
        `${this.apiUrl}/${this.path}/me`,
        {
          headers: { 'x-silent-auth': '1' },
        }
      )
      .pipe(map((res) => res?.user ?? null));
  }

  /** Invalida lo stato in memoria (nessun cookie toccabile via JS). */
  clear(): void {
    this.set(null);
  }

  /**
   * Observable che emette l'utente corrente alla sottoscrizione e poi
   * ad ogni cambiamento futuro (login, logout, scadenza, 401/403):
   * niente polling, solo eventi.
   */
  sessionChanges(): Observable<SessionUser | null> {
    return this.sessionChangedSubject.asObservable();
  }

  private set(user: SessionUser | null): void {
    this.userSignal.set(user);
    this.sessionChangedSubject.next(user);
  }
}

/**
 * APP_INITIALIZER: l'identita' viene risolta PRIMA del bootstrap dell'app,
 * cosi' AuthGuard e template usano lo stato corretto subito.
 */
export function appBootstrapSession(meService: MeService): () => Promise<unknown> {
  return () => meService.refresh();
}
