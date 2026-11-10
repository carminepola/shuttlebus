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

/** Testo di un oggetto multilingua ({ it, en, ... }) nella prima lingua disponibile. */
export function pickText(value: any, chain: string[] = languageFallbackChain()): string {
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value : '';
  for (const l of chain) {
    if (typeof value[l] === 'string' && value[l] !== '') return value[l];
  }
  // nessuna delle lingue note: il primo testo presente
  return (Object.values(value).find((v) => typeof v === 'string' && v !== '') as string) || '';
}
