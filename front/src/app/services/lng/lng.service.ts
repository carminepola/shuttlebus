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

  private cacheMap: Map<string, any> | null = null;

  /**
   * Salva le traduzioni scaricate (sessionStorage per i reload) e aggiorna la cache.
   * Da usare al posto di scrivere sessionStorage['lng'] a mano.
   */
  setTranslations(list: any[]) {
    try {
      sessionStorage.setItem('lng', JSON.stringify(list || []));
    } catch {}
    this.cacheMap = this.index(list);
  }

  private index(list: any): Map<string, any> {
    const map = new Map<string, any>();
    if (Array.isArray(list)) for (const x of list) if (x && x.txt) map.set(x.txt, x);
    return map;
  }

  /**
   * Traduzioni indicizzate per chiave, in memoria. sessionStorage si legge una sola
   * volta: prima ogni traslate rileggeva e confrontava l'intero JSON (centinaia di KB)
   * a ogni change detection, e con molti testi la pagina si bloccava.
   */
  private rows(): Map<string, any> {
    if (!this.cacheMap || this.cacheMap.size === 0) {
      let list: any = [];
      try {
        list = JSON.parse(sessionStorage.getItem('lng') || '[]');
      } catch {}
      this.cacheMap = this.index(list);
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
