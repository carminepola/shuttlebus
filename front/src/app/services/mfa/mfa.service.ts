import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom, Observable } from 'rxjs';
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import { environment } from '../../../environments/environment';

export type MfaMethod = 'totp' | 'email';
/** Al login si puo' usare un codice di recupero al posto del secondo fattore. */
export type MfaLoginMethod = MfaMethod | 'recovery';

/** Risposta del login quando l'account ha la verifica in due passaggi. */
export interface MfaChallenge {
  mfaRequired: true;
  methods: MfaMethod[];
  mfaToken: string;
}

export interface MfaStatus {
  totp: boolean;
  email: boolean;
  recoveryCodes: number;
  passkeys: { id: string; name: string; createdAt: number; lastUsedAt?: number }[];
}

// Errori gestiti nel componente (codice errato, ticket scaduto): niente redirect
// automatico a /not-authorized o /too-many-requests dall'interceptor.
const SILENT = { headers: { 'x-silent-auth': '1' } };

@Injectable({
  providedIn: 'root',
})
export class MfaService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  isMfaChallenge(response: any): response is MfaChallenge {
    return !!response?.mfaRequired && !!response?.mfaToken;
  }

  // ------------------------------------------------------------ login

  verifyLogin(mfaToken: string, method: MfaLoginMethod, code: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/mfa/verify`, { mfaToken, method, code }, SILENT);
  }

  resendLoginEmail(mfaToken: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth/mfa/email`, { mfaToken }, SILENT);
  }

  passkeySupported(): boolean {
    return browserSupportsWebAuthn();
  }

  /** Login senza password: il browser propone le passkey salvate per il sito. */
  async loginWithPasskey(rememberMe: boolean = true): Promise<void> {
    const { challengeId, options } = await lastValueFrom(
      this.http.post<any>(`${this.apiUrl}/auth/passkey/options`, {}, SILENT),
    );
    const response = await startAuthentication({ optionsJSON: options });
    await lastValueFrom(
      this.http.post<any>(`${this.apiUrl}/auth/passkey/verify`, { challengeId, response, rememberMe }, SILENT),
    );
  }

  // ------------------------------------------------------------ account

  getStatus(): Observable<MfaStatus> {
    return this.http.get<MfaStatus>(`${this.apiUrl}/mfa/status`);
  }

  setupTotp(): Observable<{ secret: string; uri: string }> {
    return this.http.post<{ secret: string; uri: string }>(`${this.apiUrl}/mfa/totp/setup`, {});
  }

  enableTotp(code: string): Observable<{ recoveryCodes: string[] | null }> {
    return this.http.post<{ recoveryCodes: string[] | null }>(`${this.apiUrl}/mfa/totp/enable`, { code }, SILENT);
  }

  disableTotp(code: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/mfa/totp/disable`, { code }, SILENT);
  }

  sendEmailCode(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/mfa/email/send`, {}, SILENT);
  }

  enableEmail(code: string): Observable<{ recoveryCodes: string[] | null }> {
    return this.http.post<{ recoveryCodes: string[] | null }>(`${this.apiUrl}/mfa/email/enable`, { code }, SILENT);
  }

  disableEmail(code: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/mfa/email/disable`, { code }, SILENT);
  }

  regenerateRecoveryCodes(method: MfaMethod, code: string): Observable<{ recoveryCodes: string[] }> {
    return this.http.post<{ recoveryCodes: string[] }>(`${this.apiUrl}/mfa/recovery/regenerate`, { method, code }, SILENT);
  }

  async registerPasskey(name: string): Promise<void> {
    const { challengeId, options } = await lastValueFrom(
      this.http.post<any>(`${this.apiUrl}/mfa/passkey/options`, {}),
    );
    const response = await startRegistration({ optionsJSON: options });
    await lastValueFrom(
      this.http.post<any>(`${this.apiUrl}/mfa/passkey/verify`, { challengeId, response, name }, SILENT),
    );
  }

  removePasskey(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/mfa/passkey/${encodeURIComponent(id)}`);
  }
}
