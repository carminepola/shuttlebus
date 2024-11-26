import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/auth`, { email, password });
  }

  logout(): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/auth`);
  }

  isLoggedIn(): boolean {
    return !!this.getToken() || !!this.getCookie('jwt');
  }

  private getCookie(name: string): boolean {
    return document.cookie.split(';').some((c) => {
      return c.trim().startsWith(`${name}=`);
    });
  }

  getToken(): string | null {
    const token = localStorage.getItem('token');
    return token ? JSON.parse(atob(token.split('.')[1])).sub : null;
  }
}
