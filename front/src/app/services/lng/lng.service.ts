import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class LngService {
  private apiUrl = environment.apiUrl + '/lng';

  constructor(private http: HttpClient) {}

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
    return localStorage.getItem('currentLng') || 'it';
  }
  traslate(id: string) {
    let obj = JSON.parse(sessionStorage['lng']);
    if (obj.length > 0) {
      let find = obj.find((x: any) => x.txt === id);
      if (find) {
        return find[this.getLng()];
      }
      return id;
    }
  }
}
