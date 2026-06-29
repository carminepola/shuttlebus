import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class TestEmailService {
  private apiUrl = environment.apiUrl + '/test/mail';

  constructor(private http: HttpClient) {}

  sendTemplate(type: string, to: string, lng: string): Observable<any> {
    return this.http.post(this.apiUrl, { type, to, lng }).pipe(
      catchError((error) => {
        return throwError(
          () => new Error(error?.error?.message || 'Invio email fallito'),
        );
      }),
    );
  }

  sendHello(to: string): Observable<any> {
    return this.http.post(this.apiUrl + '/hello', { to }).pipe(
      catchError((error) => {
        return throwError(
          () => new Error(error?.error?.message || 'Invio email fallito'),
        );
      }),
    );
  }
}
