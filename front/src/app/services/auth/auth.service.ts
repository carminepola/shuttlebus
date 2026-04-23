import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { jwtDecode } from 'jwt-decode';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private path = 'auth';

  constructor(private http: HttpClient) {}

  login(email: string, password: string, rememberMe: boolean): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${this.path}`, {
      email,
      password,
      rememberMe,
    });
  }

  recoverPassword(email: string, lng: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${this.path}/recoverPassword`, {
      email,
      lng,
    });
  }
  logout(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${this.path}`);
  }
  isLoggedIn(): boolean {
    return !!this.getCookieExists('jwt');
  }

  getDecodedToken(): any {
    const jwt = this.getCookie('jwt');
    if (jwt) {
      try {
        return jwtDecode(jwt);
      } catch (error) {
        console.error('Invalid JWT', error);
      }
    }
    return undefined;
  }

  getToken(): any {
    return this.getCookie('jwt');
  }
  deleteCookie(name: string): void {
    document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
  }
  private getCookieExists(name: string): boolean {
    return document.cookie.split(';').some((c) => {
      return c.trim().startsWith(`${name}=`);
    });
  }

  private getCookie(name: string): string | null {
    const match = document.cookie
      .split(';')
      .find((c) => c.trim().startsWith(`${name}=`));
    if (!match) return null;
    const eqIndex = match.indexOf('=');
    return match.substring(eqIndex + 1);
  }
}
