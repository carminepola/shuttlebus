import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';
import localeFr from '@angular/common/locales/fr';
import localeDe from '@angular/common/locales/de';
import localeEs from '@angular/common/locales/es';
import localeJa from '@angular/common/locales/ja';
import localePt from '@angular/common/locales/pt';
import localeNl from '@angular/common/locales/nl';
import localePl from '@angular/common/locales/pl';
import localeRo from '@angular/common/locales/ro';
import localeRu from '@angular/common/locales/ru';
import localeEl from '@angular/common/locales/el';
import localeTr from '@angular/common/locales/tr';
import localeZh from '@angular/common/locales/zh';
import localeAr from '@angular/common/locales/ar';
import localeUk from '@angular/common/locales/uk';
import { readCachedLanguages } from '../languages/languages.service';

/**
 * Locale Angular (date, numeri, valuta) della lingua scelta dall'utente.
 * Il cambio lingua ricarica la pagina, quindi basta leggerla all'avvio (LOCALE_ID).
 * Il locale di ogni lingua e' nella sua configurazione (Impostazioni -> Lingue, es. jp -> ja);
 * se Angular non ne ha i dati registrati qui sotto si usa l'inglese.
 */
const LOCALE_DATA: Record<string, any> = {
  it: localeIt,
  fr: localeFr,
  de: localeDe,
  es: localeEs,
  ja: localeJa,
  pt: localePt,
  nl: localeNl,
  pl: localePl,
  ro: localeRo,
  ru: localeRu,
  el: localeEl,
  tr: localeTr,
  zh: localeZh,
  ar: localeAr,
  uk: localeUk,
};
for (const data of Object.values(LOCALE_DATA)) registerLocaleData(data);

/** Locale con dati disponibili (en e' sempre incluso in Angular). */
export function supportedLocale(locale: string | undefined): string {
  const base = String(locale || '').split('-')[0].toLowerCase();
  return base === 'en' || LOCALE_DATA[base] ? base : 'en';
}

export function appLocale(): string {
  let lng = 'it';
  try {
    lng = localStorage.getItem('currentLng') || 'it';
  } catch {}
  const configured = readCachedLanguages()?.languages.find((l) => l.code === lng)?.locale;
  return supportedLocale(configured || (lng === 'jp' ? 'ja' : lng));
}
