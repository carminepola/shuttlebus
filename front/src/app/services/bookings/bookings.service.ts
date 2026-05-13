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
    bagagli: number,
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
    status: string,
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
  andamentoVendite() {
    return this.http.get(this.apiUrl + '/andamentoVendite');
  }
  currentDayBookingsFromScheduleId(scheduleId: string) {
    return this.http.post(this.apiUrl + '/currentDayBookingsFromScheduleId', {
      scheduleId,
    });
  }
  readBookingById(id: string) {
    return this.http.post(this.apiUrl + '/readBookingById', { id });
  }
  scanTicket(id: string) {
    return this.http.post(this.apiUrl + '/scanTicket', { id });
  }
  getBookingsByUserId(userId: string) {
    return this.http.get<any>(`${this.apiUrl}/getBookingByUserId/${userId}`);
  }
  getTopClients() {
    return this.http.get<any>(`${this.apiUrl}/topClients`);
  }
  getRecentPurchases(page: number = 1, limit: number = 20) {
    return this.http.get<any>(`${this.apiUrl}/recentPurchases`, {
      params: { page, limit },
    });
  }
  getDashboardStats() {
    return this.http.get<any>(`${this.apiUrl}/dashboardStats`);
  }
  getYearlyStats() {
    return this.http.get<any>(`${this.apiUrl}/yearlyStats`);
  }

  hasTicketForRoute(
    routeId: string,
    date: string,
    fromStopId: string,
    toStopId: string,
  ): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/hasTicketForRoute`, {
      params: { routeId, date, fromStopId, toStopId },
    });
  }

  getRevenueByPaymentMethod(
    startDate?: string,
    endDate?: string,
  ): Observable<any> {
    let params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return this.http.get<any>(`${this.apiUrl}/revenueByPaymentMethod`, {
      params,
    });
  }

  getDailyRevenueByRoute(date: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dailyRevenueByRoute`, {
      params: { date },
    });
  }

  getMonthlyRevenue(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/getMonthlyRevenue`);
  }
}
