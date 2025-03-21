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
    return this.http.post(this.apiUrl + '/findAvailableRoutes', {
      fromStopId: partenza,
      toStopId: arrivo,
      posti: persone,
      travelDate: data,
      bagagli: bagagli,
    });
  }
  insertBooking(ticket: any): Observable<any> {
    return this.http.post(this.apiUrl + '/insertBooking', ticket);
  }
  readBookingConfirmed(
    date: string,
    routeId: string,
    scheduleId: string,
    status: string
  ) {
    return this.http.post(this.apiUrl + '/readBookingConfirmed', {
      date,
      routeId,
      scheduleId,
      status,
    });
  }

  getBookingFromUser(): Observable<any> {
    return this.http.get(this.apiUrl + '/getBookingFromUser');
  }
  deleteBooking(id: string): Observable<any> {
    return this.http.post(this.apiUrl + '/deleteBooking', { id });
  }
  refundBooking(id: string): Observable<any> {
    return this.http.post(this.apiUrl + '/refundBooking', { id });
  }
  cancelBooking(id: string): Observable<any> {
    return this.http.post(this.apiUrl + '/cancelBooking', { id });
  }
  ticketToDay() {
    return this.http.get(this.apiUrl + '/ticketToDay');
  }
  seatsToDay() {
    return this.http.get(this.apiUrl + '/seatsToDay');
  }
  andamento() {
    return this.http.get(this.apiUrl + '/andamento');
  }
  currentDayBookingsFromScheduleId(scheduleId: string) {
    return this.http.post(this.apiUrl + '/currentDayBookingsFromScheduleId', {
      scheduleId,
    });
  }
  readBookingById(id: string) {
    return this.http.post(this.apiUrl + '/readBookingById', { id });
  }
}
