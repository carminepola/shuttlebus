import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

@Injectable({
  providedIn: 'root',
})
export class PasskeyService {
  private apiUrl = environment.apiUrl;
  private path = 'passkeys';

  constructor(private http: HttpClient) {}

  isSupported(): boolean {
    return browserSupportsWebAuthn();
  }

  getRegistrationOptions(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${this.path}/registration/options`, {});
  }

  async register(name?: string): Promise<any> {
    const options = await this.getRegistrationOptions().toPromise();
    const response = await startRegistration({ optionsJSON: options });
    return this.http
      .post<any>(`${this.apiUrl}/${this.path}/registration/verify`, {
        response,
        name,
      })
      .toPromise();
  }

  getPasskeys(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${this.path}`);
  }

  deletePasskey(passkeyId: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${this.path}/${passkeyId}`);
  }

  getAuthenticationOptions(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${this.path}/authentication/options`, { email });
  }

  async authenticate(email: string, rememberMe: boolean = false): Promise<any> {
    const options = await this.getAuthenticationOptions(email).toPromise();
    const response = await startAuthentication({ optionsJSON: options });
    return this.http
      .post<any>(`${this.apiUrl}/${this.path}/authentication/verify`, {
        email,
        response,
        rememberMe,
      })
      .toPromise();
  }
}
