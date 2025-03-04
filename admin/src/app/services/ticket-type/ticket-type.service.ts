import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class TicketTypeService {
  private apiUrl = environment.apiUrl + '/ticketType';

  constructor(private http: HttpClient) {}

  createTicketType(ticketTypeData: any): Observable<any> {
    return this.http.post(this.apiUrl, ticketTypeData).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  getAllActiveTicketTypes(): Observable<any> {
    return this.http.get<any[]>(this.apiUrl + '/all').pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  getTicketType(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/id/${id}`).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  getAllTicketTypes(): Observable<any> {
    return this.http.get<any[]>(`${this.apiUrl}/all`).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  updateTicketType(ticketTypeData: any): Observable<any> {
    return this.http.patch(`${this.apiUrl}`, ticketTypeData).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  deleteTicketType(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
}
