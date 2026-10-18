import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MeService, SessionUser } from './me.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private path = 'auth';

  constructor(
    private http: HttpClient,
    private meService: MeService
  ) {}

  login(email: string, password: string, rememberMe: boolean): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${this.path}`, {
      email,
      password,
      rememberMe,
    });
  }

  /** Ricarica l'identita' da /auth/me: da chiamare dopo un login riuscito. */
  refreshSession(): Promise<SessionUser | null> {
    return this.meService.refresh();
  }

  recoverPassword(email: string, lng: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${this.path}/recoverPassword`, {
      email,
      lng,
    });
  }

  /** Invio nuova password usando il token ricevuto via email. */
  resetPassword(token: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${this.path}/resetPassword`, {
      token,
      password,
    });
  }

  logout(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${this.path}`);
  }
  /** Stato di autenticazione gestito server-side (lista cookie pronta in MeService). */
  isLoggedIn(): boolean {
    return this.meService.isLoggedIn();
  }

  /**
   * Identita' corrente: NON legge piu' cookie via JS (jwt e' httpOnly).
   * Ritorna i claim scaricati da GET /auth/me.
   */
  getDecodedToken(): SessionUser | null {
    return this.meService.session();
  }

  /** @deprecated il jwt non e' piu' raggiungibile via JS (httpOnly). */
  getToken(): any {
    return null;
  }

  /** Invalida lo stato in memoria (chiamata su 401/403). */
  clearSession(): void {
    this.meService.clear();
  }

  deleteCookie(name: string): void {
    // noop: il cookie jwt e' httpOnly, non cancellabile via JavaScript.
    // La revoca reale avviene server-side (logout o scadenza sessione).
    this.meService.clear();
  }
}
