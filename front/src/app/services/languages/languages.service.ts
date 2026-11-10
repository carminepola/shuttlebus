import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Lingua configurata da Impostazioni -> Lingue (stessa struttura del back). */
export interface Language {
  code: string;
  name: string;
  flag: string;
  locale: string;
  enabled: boolean;
}

export interface LanguageSettings {
  defaultLanguage: string;
  languages: Language[];
}

/** Usate solo se il server non risponde e non c'e' nulla in cache. */
export const FALLBACK_LANGUAGES: LanguageSettings = {
  defaultLanguage: 'it',
  languages: [
    { code: 'it', name: 'Italiano', flag: '🇮🇹', locale: 'it', enabled: true },
    { code: 'en', name: 'English', flag: '🇬🇧', locale: 'en', enabled: true },
  ],
};

export const LANGUAGES_STORAGE_KEY = 'languages';

export function readCachedLanguages(): LanguageSettings | null {
  try {
    const raw = localStorage.getItem(LANGUAGES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && Array.isArray(parsed.languages) && parsed.languages.length ? parsed : null;
  } catch {
    return null;
  }
}

@Injectable({
  providedIn: 'root',
})
export class LanguagesService {
  private apiUrl = environment.apiUrl + '/languages';
  private settings: LanguageSettings = readCachedLanguages() || FALLBACK_LANGUAGES;

  constructor(private http: HttpClient) {}

  /** All'avvio dell'app: lingue aggiornate dal server (in cache per il prossimo avvio). */
  async load(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<LanguageSettings>(this.apiUrl).pipe(timeout(5000)));
      if (res && Array.isArray(res.languages) && res.languages.length) {
        this.settings = res;
        try {
          localStorage.setItem(LANGUAGES_STORAGE_KEY, JSON.stringify(res));
        } catch {}
      }
    } catch {
      // server non raggiungibile: restano quelle in cache
    }
  }

  /** Lingue selezionabili dagli utenti. */
  get enabled(): Language[] {
    return this.settings.languages.filter((l) => l.enabled);
  }

  /** Tutte le lingue configurate (anche disattivate): editor traduzioni e testi multilingua. */
  get all(): Language[] {
    return this.settings.languages;
  }

  get defaultLanguage(): string {
    return this.settings.defaultLanguage;
  }

  get current(): LanguageSettings {
    return this.settings;
  }

  isEnabled(code: string): boolean {
    return this.enabled.some((l) => l.code === code);
  }

  find(code: string): Language | undefined {
    return this.settings.languages.find((l) => l.code === code);
  }

  /** Etichetta per i menu: "🇮🇹 Italiano". */
  label(l: Language): string {
    return `${l.flag ? l.flag + ' ' : ''}${l.name}`;
  }

  async save(settings: LanguageSettings): Promise<LanguageSettings> {
    const res = await firstValueFrom(this.http.put<LanguageSettings>(this.apiUrl, settings));
    this.settings = res;
    try {
      localStorage.setItem(LANGUAGES_STORAGE_KEY, JSON.stringify(res));
    } catch {}
    return res;
  }
}
