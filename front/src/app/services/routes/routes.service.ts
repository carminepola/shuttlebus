import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class RoutesService {
  private apiUrl = environment.apiUrl + '/routes';

  constructor(private http: HttpClient) {}

  getRoutes(): Observable<any> {
    return this.http.get(`${this.apiUrl}`).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  getRouteById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  insertRoute(route: any): Observable<any> {
    return this.http.post(`${this.apiUrl}`, { route }).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  updateRoute(
    nameIt: string,
    nameEn: string,
    stops: any,
    ticketTypes: any,
    id: string,
    enabled: boolean
  ): Observable<any> {
    return this.http
      .put(`${this.apiUrl}/${id}`, {
        nameIt,
        nameEn,
        stops,
        ticketTypes,
        enabled,
      })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  deleteRoute(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  getEnabledRoutes(): Observable<any> {
    return this.http.get(`${this.apiUrl}/enabled`).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  insertSchedule(schedule: any, routeId: string): Observable<any> {
    return this.http
      .post(`${this.apiUrl}/schedule/${routeId}/`, { schedule })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  updateSchedule(
    scheduleId: string,
    schedule: any,
    routeId: string
  ): Observable<any> {
    return this.http
      .put(`${this.apiUrl}/schedule/${routeId}/${scheduleId}`, { schedule })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }
}
