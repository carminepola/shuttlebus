import { readCachedLanguages } from '../services/languages/languages.service';

/**
 * Lingue in cui cercare un testo: corrente, predefinita (Impostazioni -> Lingue),
 * inglese, italiano. Usata da LngService, pipe translateName e componenti.
 */
export function languageFallbackChain(current?: string): string[] {
  let lng = current;
  if (!lng) {
    try {
      lng = localStorage.getItem('currentLng') || undefined;
    } catch {}
  }
  const def = readCachedLanguages()?.defaultLanguage;
  return [...new Set([lng, def, 'en', 'it'].filter((x): x is string => !!x))];
}

const LANGUAGE_KEY = /^[a-z]{2,3}(-[a-z0-9]{2,4})?$/;
const NOT_LANGUAGE = new Set(['id', 'txt']);

/** Testo di un oggetto multilingua ({ it, en, ... }) nella prima lingua disponibile. */
export function pickText(value: any, chain: string[] = languageFallbackChain()): string {
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value : '';
  for (const l of chain) {
    if (typeof value[l] === 'string' && value[l] !== '') return value[l];
  }
  // nessuna delle lingue della catena: il primo testo in un'altra lingua. Solo chiavi
  // che sono codici lingua: in una riga di traduzione ci sono anche _id, id e txt, e con
  // tutte le lingue vuote (es. str_alert, lasciata vuota apposta) usciva l'_id Mongo.
  for (const [k, v] of Object.entries(value)) {
    if (LANGUAGE_KEY.test(k) && !NOT_LANGUAGE.has(k) && typeof v === 'string' && v !== '') return v;
  }
  return '';
}
