import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class LicensePlateService {
  private apiUrl = environment.apiUrl + '/licensePlate';

  constructor(private http: HttpClient) {}

  getAll(): Observable<any> {
    return this.http.get(this.apiUrl).pipe(
      catchError((error) => {
        return throwError(() => error);
      }),
    );
  }

  getEnabled(): Observable<any> {
    return this.http.get(this.apiUrl + '/enabled').pipe(
      catchError((error) => {
        return throwError(() => error);
      }),
    );
  }

  getById(id: string): Observable<any> {
    return this.http.get(this.apiUrl + '/' + id).pipe(
      catchError((error) => {
        return throwError(() => error);
      }),
    );
  }

  post(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data).pipe(
      catchError((error) => {
        return throwError(() => error);
      }),
    );
  }

  patch(data: any): Observable<any> {
    return this.http.patch(this.apiUrl, data).pipe(
      catchError((error) => {
        return throwError(() => error);
      }),
    );
  }

  delete(id: string): Observable<any> {
    return this.http.delete(this.apiUrl + '/' + id).pipe(
      catchError((error) => {
        return throwError(() => error);
      }),
    );
  }

  getMomapDevices(): Observable<any> {
    return this.http.get(environment.apiUrl + '/momap/devices').pipe(
      catchError((error) => {
        return throwError(() => error);
      }),
    );
  }
}
