import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class LngService {
  private apiUrl = environment.apiUrl + '/lng';

  constructor(private http: HttpClient, private authService: AuthService) {}

  get(): Observable<any> {
    return this.http.get(this.apiUrl).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
  post(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
  patch(data: any): Observable<any> {
    return this.http.patch(this.apiUrl, data).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  setLng(data: string) {
    localStorage.setItem('currentLng', data);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = data;
    }
  }
  getLng(): string {
    return localStorage.getItem('currentLng') || 'it';
  }
  traslate(id: string) {
    if (!id) {
      return id;
    }
    let obj: any[];
    try {
      const raw = sessionStorage.getItem('lng');
      if (!raw) {
        return id;
      }
      obj = JSON.parse(raw);
    } catch (e) {
      return id;
    }
    if (!Array.isArray(obj) || obj.length === 0) {
      return id;
    }
    const find = obj.find((x: any) => x && x.txt === id);
    if (!find) {
      return id;
    }
    const value = find[this.getLng()];
    if (value === undefined || value === null || value === '') {
      return id;
    }
    return value;
  }

  /** Come traslate, ma con un testo di riserva se la chiave non e' ancora tradotta. */
  traslateOr(id: string, fallback: string) {
    const value = this.traslate(id);
    return value === id ? fallback : value;
  }
}
