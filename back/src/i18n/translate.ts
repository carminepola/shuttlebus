import { Db } from "mongodb";
import defaultLng from "../data/lng.json";
import { getLanguageSettings } from "./languages";
import { applyCompanyToText } from "../utils/company";

/**
 * Traduzioni lato server (mail, Stripe, messaggi): stessa collection `lng` del front.
 * Ordine di ricerca: lingua richiesta -> lingua predefinita -> en -> it, prima
 * nel DB (modifiche dell'admin) e poi in src/data/lng.json. Chiave assente: la chiave.
 * Le variabili {nome} vengono sostituite con i valori passati (gia' sicuri per HTML
 * se il testo finisce in una mail: vedi mail/renderMail.ts).
 */

const CACHE_MS = 60 * 1000;
const DEFAULTS = defaultLng as Record<string, Record<string, string>>;

let cache: { at: number; rows: Map<string, Record<string, string>> } | null = null;

async function dbRows(db: Db): Promise<Map<string, Record<string, string>>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const rows = new Map<string, Record<string, string>>();
  try {
    for (const r of await db.collection("lng").find({}, { projection: { _id: 0 } }).toArray()) rows.set((r as any).txt, r as any);
  } catch {
    // DB non raggiungibile: solo i testi di default
  }
  cache = { at: Date.now(), rows };
  return rows;
}

/** Da chiamare dopo una modifica delle traduzioni. */
export function invalidateTranslations() {
  cache = null;
}

export function fillVariables(text: string, vars: Record<string, string> = {}): string {
  return text.replace(/\{(\w+)\}/g, (m, name) => (Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : m));
}

export class Translator {
  private constructor(
    private rows: Map<string, Record<string, string>>,
    private chain: string[],
    public readonly lng: string,
  ) {}

  static async for(db: Db, lng: string | undefined): Promise<Translator> {
    const settings = await getLanguageSettings(db);
    const wanted = String(lng || "").toLowerCase();
    const chain = [...new Set([wanted, settings.defaultLanguage, "en", "it"].filter(Boolean))];
    return new Translator(await dbRows(db), chain, chain[0]);
  }

  /** Testo della chiave nella prima lingua disponibile, con nome azienda e variabili. */
  t(key: string, vars: Record<string, string> = {}): string {
    const sources = [this.rows.get(key), DEFAULTS[key]];
    for (const source of sources) {
      if (!source) continue;
      for (const l of this.chain) {
        const value = source[l];
        if (typeof value === "string" && value.trim() !== "") return fillVariables(applyCompanyToText(value), vars);
      }
    }
    return key;
  }
}
