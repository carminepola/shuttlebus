import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class AttendanceService {
  private apiUrl = environment.apiUrl + '/attendance';

  constructor(private http: HttpClient) {}

  getByMonth(year: number, month: number): Observable<any> {
    return this.http
      .get(this.apiUrl, { params: { year, month } })
      .pipe(
        catchError((error) => throwError(() => error)),
      );
  }

  addPerson(year: number, month: number, name: string): Observable<any> {
    return this.http
      .post(this.apiUrl, { year, month, name, days: {} })
      .pipe(
        catchError((error) => throwError(() => error)),
      );
  }

  update(id: string, name: string, days: Record<string, string>): Observable<any> {
    return this.http
      .patch(this.apiUrl, { id, name, days })
      .pipe(
        catchError((error) => throwError(() => error)),
      );
  }

  delete(id: string): Observable<any> {
    return this.http
      .delete(this.apiUrl + '/' + id)
      .pipe(
        catchError((error) => throwError(() => error)),
      );
  }
}
