import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class StripeService {
  private apiUrl = environment.apiUrl + '/stripe';
  constructor(private http: HttpClient) {}
  delete(id: string): Observable<any> {
    return this.http.post(this.apiUrl + '/delete', { id }).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
  forceDelete(id: string): Observable<any> {
    return this.http.post(this.apiUrl + '/forceDelete', { id }).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
  refund(id: string): Observable<any> {
    return this.http.post(this.apiUrl + '/refund', { id }).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
}
