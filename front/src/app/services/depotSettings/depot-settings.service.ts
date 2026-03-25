import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class DepotSettingsService {
  private apiUrl = environment.apiUrl + '/depotSettings';

  constructor(private http: HttpClient) {}

  get(): Observable<any> {
    return this.http.get(this.apiUrl).pipe(
      catchError((error) => {
        console.error('Failed to load depot settings:', error);
        return throwError(
          () => new Error('Impossibile caricare le impostazioni del deposito'),
        );
      }),
    );
  }

  patch(data: any): Observable<any> {
    return this.http.patch(this.apiUrl, data).pipe(
      catchError((error) => {
        console.error('Failed to update depot settings:', error);
        return throwError(
          () =>
            new Error('Impossibile aggiornare le impostazioni del deposito'),
        );
      }),
    );
  }
}
