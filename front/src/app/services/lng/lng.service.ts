import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class LngService {
  private apiUrl = environment.apiUrl + '/lng';
  private currentUrlLang = '';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
  ) {}

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
  }
  getLng(): string {
    if (this.currentUrlLang) return this.currentUrlLang;
    return localStorage.getItem('currentLng') || 'it';
  }

  setCurrentUrlLang(lang: string) {
    this.currentUrlLang = lang;
  }

  langPath(path: string): string {
    const lng = this.getLng();
    let clean = path.startsWith('/') ? path.substring(1) : path;
    clean = clean.replace(/\/+$/, '');
    if (!clean) return `/${lng}`;
    return `/${lng}/${clean}`;
  }

  langPathArray(path: string): string[] {
    const lng = this.getLng();
    let clean = path.startsWith('/') ? path.substring(1) : path;
    clean = clean.replace(/\/+$/, '');
    if (!clean) return [lng];
    return [lng, ...clean.split('/')];
  }

  switchLang(newLng: string) {
    this.setLng(newLng);
    const url = this.router.url;
    const segments = url.split('/').filter(Boolean);
    if (segments.length > 0 && this.isSupported(segments[0])) {
      segments[0] = newLng;
      this.router.navigateByUrl('/' + segments.join('/')).then(() => {
        window.location.reload();
      });
    } else {
      this.router.navigateByUrl('/' + newLng).then(() => {
        window.location.reload();
      });
    }
  }

  isSupported(lng: string): boolean {
    return ['it', 'en', 'fr', 'de', 'es', 'jp'].includes(lng);
  }

  getSupportedLngs(): string[] {
    return ['it', 'en', 'fr', 'de', 'es', 'jp'];
  }

  traslate(id: string) {
    let obj = JSON.parse(sessionStorage['lng']);
    if (obj.length > 0) {
      let find = obj.find((x: any) => x.txt === id);

      if (find) {
        if (find[this.getLng()] == '') {
          return id;
        }

        return find[this.getLng()];
      }
      return id;
    }
  }
}
