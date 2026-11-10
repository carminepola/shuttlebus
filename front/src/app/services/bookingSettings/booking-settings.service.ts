import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/** Impostazioni delle prenotazioni (Impostazioni -> Prenotazioni). */
export interface BookingSettings {
  /** Vendite online chiuse N minuti prima della partenza. */
  bookingCutoffMinutes: number;
  /** Rimborso dal cliente possibile fino a N giorni prima della corsa. */
  refundCutoffDays: number;
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  bookingCutoffMinutes: 120,
  refundCutoffDays: 3,
};

@Injectable({
  providedIn: 'root',
})
export class BookingSettingsService {
  private apiUrl = environment.apiUrl + '/bookingSettings';
  private cache$?: Observable<BookingSettings>;

  constructor(private http: HttpClient) {}

  /** Letta una volta per sessione (`fresh`: rilegge dal server); se il server non risponde valgono i default. */
  get(fresh = false): Observable<BookingSettings> {
    if (fresh) this.cache$ = undefined;
    if (!this.cache$) {
      this.cache$ = this.http.get<{ settings: BookingSettings }>(this.apiUrl).pipe(
        map((res) => ({ ...DEFAULT_BOOKING_SETTINGS, ...(res?.settings || {}) })),
        catchError(() => {
          this.cache$ = undefined;
          return of({ ...DEFAULT_BOOKING_SETTINGS });
        }),
        shareReplay(1),
      );
    }
    return this.cache$;
  }

  patch(data: Partial<BookingSettings>): Observable<any> {
    return this.http.patch(this.apiUrl, data).pipe(tap(() => (this.cache$ = undefined)));
  }
}
