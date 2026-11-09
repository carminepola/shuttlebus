/**
 * Locale Angular (date, numeri, valuta) della lingua scelta dall'utente.
 * Il cambio lingua ricarica la pagina, quindi basta leggerla all'avvio (LOCALE_ID).
 */
const LOCALES: Record<string, string> = { it: 'it', en: 'en', fr: 'fr', de: 'de', es: 'es', jp: 'ja' };

export function appLocale(): string {
  let lng = 'it';
  try {
    lng = localStorage.getItem('currentLng') || 'it';
  } catch {}
  return LOCALES[lng] || 'it';
}
