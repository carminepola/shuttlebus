import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';
import { LanguagesService } from '../languages/languages.service';
import { Router } from '@angular/router';
import { pickText } from '../../utils/i18n';

@Injectable({
  providedIn: 'root',
})
export class LngService {
  private apiUrl = environment.apiUrl + '/lng';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private languages: LanguagesService,
    private router: Router,
  ) {}

  /** `raw`: testi con i segnaposto ({{company}}, ...) per la pagina admin Traduzioni. */
  get(raw = false): Observable<any> {
    return this.http.get(this.apiUrl, raw ? { params: { raw: 'true' } } : {}).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
  post(data: any): Observable<any> {
    return this.http.post(this.apiUrl, data).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }
  patch(data: any): Observable<any> {
    return this.http.patch(this.apiUrl, data).pipe(
      catchError((error) => {
        return throwError(() => error);
      })
    );
  }

  /** Lingue selezionabili, per i menu: [{ lng: 'it', name: '🇮🇹 Italiano' }]. */
  get languageOptions(): { lng: string; name: string }[] {
    return this.languages.enabled.map((l) => ({ lng: l.code, name: this.languages.label(l) }));
  }

  setLng(data: string) {
    localStorage.setItem('currentLng', data);
    if (typeof document !== 'undefined') {
      // attributo lang col locale vero (es. jp -> ja)
      document.documentElement.lang = this.languages.find(data)?.locale || data;
    }
  }

  /** Cambia lingua e ricarica la pagina (date, numeri e testi ripartono nella nuova lingua). */
  changeLng(code: string) {
    this.setLng(code);
    this.router.navigate([this.router.url]).then(() => window.location.reload());
  }

  /** Lingua corrente: quella scelta se ancora attiva, altrimenti la predefinita. */
  getLng(): string {
    const saved = localStorage.getItem('currentLng');
    return saved && this.languages.isEnabled(saved) ? saved : this.languages.defaultLanguage;
  }

  /** Ordine di ricerca dei testi: lingua corrente, predefinita, inglese, italiano. */
  fallbackChain(): string[] {
    return [...new Set([this.getLng(), this.languages.defaultLanguage, 'en', 'it'])];
  }

  /** Testo di un oggetto multilingua ({ it, en, ... }) nella prima lingua disponibile. */
  pick(value: any): string {
    return pickText(value, this.fallbackChain());
  }

  private cacheRaw: string | null = null;
  private cacheMap = new Map<string, any>();

  /** Traduzioni in sessionStorage indicizzate per chiave (parse solo quando cambiano). */
  private rows(): Map<string, any> {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem('lng');
    } catch {}
    if (raw !== this.cacheRaw) {
      this.cacheRaw = raw;
      this.cacheMap = new Map();
      try {
        const list = raw ? JSON.parse(raw) : [];
        if (Array.isArray(list)) for (const x of list) if (x && x.txt) this.cacheMap.set(x.txt, x);
      } catch {}
    }
    return this.cacheMap;
  }

  traslate(id: string) {
    if (!id) {
      return id;
    }
    const row = this.rows().get(id);
    return (row && this.pick(row)) || id;
  }

  /** Come traslate, ma con un testo di riserva se la chiave non e' ancora tradotta. */
  traslateOr(id: string, fallback: string) {
    const value = this.traslate(id);
    return value === id ? fallback : value;
  }
}
