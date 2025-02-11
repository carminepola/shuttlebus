import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment.development';
@Injectable({
  providedIn: 'root',
})
export class StopsService {
  private apiUrl = environment.apiUrl + '/stops';

  constructor(private http: HttpClient) {}

  createStop(stopData: any): Observable<any> {
    return this.http.post(this.apiUrl, stopData).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  getAllActiveStops(): Observable<any> {
    debugger;
    return this.http.get<any[]>(this.apiUrl).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  getStop(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  getAllStops(): Observable<any> {
    return this.http.get<any[]>(`${this.apiUrl}/all`).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  updateStop(stopData: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${stopData.id}`, stopData).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  deleteStop(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
}
