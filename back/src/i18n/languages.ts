import { Db } from "mongodb";
import defaults from "../data/languages.json";

/**
 * Lingue dell'applicazione, configurabili da Impostazioni -> Lingue.
 * Collection `languageSettings`, documento id "default"; senza documento vale
 * src/data/languages.json. Il codice e' la chiave usata in traduzioni (lng.<code>),
 * nomi multilingua ({ it, en, ... }) e preferenze utente; `locale` e' il locale
 * per date e numeri (es. "jp" -> "ja").
 */

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

export const LANGUAGE_CODE_RE = /^[a-z]{2,3}(-[a-z0-9]{2,4})?$/;
/** Campi dei documenti che non sono lingue anche se ne hanno la forma. */
const RESERVED_KEYS = new Set(["id", "txt"]);
const LOCALE_RE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;
const COLLECTION = "languageSettings";
const CACHE_MS = 30 * 1000;

export const DEFAULT_LANGUAGE_SETTINGS = defaults as LanguageSettings;

const str = (v: any, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Configurazione valida o errore con il motivo (per la rotta admin). */
export function validateLanguageSettings(input: any): { settings?: LanguageSettings; error?: string } {
  if (!input || !Array.isArray(input.languages) || input.languages.length === 0) return { error: "Serve almeno una lingua" };
  const seen = new Set<string>();
  const languages: Language[] = [];
  for (const raw of input.languages) {
    const code = str(raw?.code, 10).toLowerCase();
    if (!LANGUAGE_CODE_RE.test(code) || RESERVED_KEYS.has(code)) return { error: `Codice lingua non valido: "${raw?.code}" (es. it, en, pt-br)` };
    if (seen.has(code)) return { error: `Lingua ripetuta: ${code}` };
    seen.add(code);
    const name = str(raw?.name, 40);
    if (!name) return { error: `Nome mancante per la lingua ${code}` };
    const locale = str(raw?.locale, 20) || code;
    if (!LOCALE_RE.test(locale)) return { error: `Locale non valido per ${code}: "${raw?.locale}"` };
    languages.push({ code, name, flag: str(raw?.flag, 16), locale, enabled: raw?.enabled !== false });
  }
  if (!languages.some((l) => l.enabled)) return { error: "Serve almeno una lingua attiva" };
  const defaultLanguage = str(input.defaultLanguage, 10).toLowerCase();
  if (!languages.some((l) => l.code === defaultLanguage && l.enabled)) return { error: "La lingua predefinita deve essere tra quelle attive" };
  return { settings: { defaultLanguage, languages } };
}

let cache: { at: number; value: LanguageSettings } | null = null;

export async function getLanguageSettings(db: Db): Promise<LanguageSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  let value = DEFAULT_LANGUAGE_SETTINGS;
  try {
    const doc = await db.collection(COLLECTION).findOne({ id: "default" });
    const checked = doc ? validateLanguageSettings(doc) : null;
    if (checked?.settings) value = checked.settings;
  } catch {
    // DB non raggiungibile: lingue di default
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function saveLanguageSettings(db: Db, settings: LanguageSettings) {
  await db.collection(COLLECTION).updateOne({ id: "default" }, { $set: { ...settings, updatedAt: Date.now() } }, { upsert: true });
  cache = { at: Date.now(), value: settings };
}

/** Tutti i codici configurati (anche disattivati: le loro traduzioni restano modificabili). */
export async function languageCodes(db: Db): Promise<string[]> {
  return (await getLanguageSettings(db)).languages.map((l) => l.code);
}

/** Lingua valida per l'utente: se non e' attiva, quella predefinita. */
export async function resolveLanguage(db: Db, lng: string | undefined): Promise<string> {
  const s = await getLanguageSettings(db);
  const code = String(lng || "").toLowerCase();
  return s.languages.some((l) => l.enabled && l.code === code) ? code : s.defaultLanguage;
}

/** Copia solo le chiavi che sono codici lingua con valore stringa (nomi multilingua, righe lng). */
export function pickLanguageStrings(obj: any, maxLength = 20000): Record<string, string> {
  const out: Record<string, string> = {};
  if (!obj || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    if (LANGUAGE_CODE_RE.test(k) && !RESERVED_KEYS.has(k) && typeof v === "string") out[k] = v.slice(0, maxLength);
  }
  return out;
}
