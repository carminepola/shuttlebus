import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class BookingsService {
  private apiUrl = environment.apiUrl + '/booking';
  constructor(private http: HttpClient) {}
  findAvailableRoutes(
    partenza: string,
    arrivo: string,
    persone: number,
    data: string,
    bagagli: number
  ): Observable<any> {
    return this.http
      .post(this.apiUrl + '/findAvailableRoutes', {
        fromStopId: partenza,
        toStopId: arrivo,
        posti: persone,
        travelDate: data,
        bagagli: bagagli,
      })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }
  insertBooking(ticket: any): Observable<any> {
    return this.http.post(this.apiUrl + '/insertBooking', ticket).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
  readBookingConfirmed(date: string, routeId: string, scheduleId: string) {
    return this.http
      .post(this.apiUrl + '/readBookingConfirmed', {
        date,
        routeId,
        scheduleId,
      })
      .pipe(
        catchError((error) => {
          return throwError(() => error);
        })
      );
  }

  getBookingForUser(): Observable<any> {
    return this.http.get(this.apiUrl + '/getBookingForUser').pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
}
