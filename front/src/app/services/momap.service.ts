import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
@Injectable({
  providedIn: 'root',
})
export class MomapService {
  private apiUrl = environment.apiUrl + '/momap';
  constructor(private http: HttpClient) {}
  getCurrent(): Observable<any> {
    return this.http.get(this.apiUrl).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
}
