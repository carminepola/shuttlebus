import { Db } from "mongodb";
import { Guid } from "guid-typescript";
import lngData from "../../data/lng.json";
import templateMailData from "../../data/templateMail.json";

/**
 * Dati di base dell'applicazione, versionati nel repository:
 * - src/data/lng.json           tutte le traduzioni { chiave: { it, en, fr, de, es, jp } }
 * - src/data/templateMail.json  tutti i template mail { TIPO: { title, body } }
 * Il nome dell'azienda e i colori sono segnaposto (vedi utils/company.ts).
 *
 * All'avvio (seedDefaultData senza opzioni) un DB nuovo riceve tutto e uno
 * esistente solo cio' che manca: chiavi e template assenti, lingue mai inserite.
 * Le traduzioni e i template gia' presenti, anche modificati dall'admin, restano.
 * Le opzioni overwrite* (script sync-default-data) sovrascrivono con i file.
 */

const LANGS = ["it", "en", "fr", "de", "es", "jp"] as const;

export interface SeedOptions {
  overwriteLng?: boolean;
  overwriteTemplates?: boolean;
  dryRun?: boolean;
  log?: (message: string) => void;
}

export interface SeedResult {
  lng: { inserted: number; updated: number };
  templates: { inserted: number; updated: number };
}

const LNG = lngData as Record<string, Record<string, string>>;
const TEMPLATES = templateMailData as Record<string, { title: string; body: string }>;

export async function seedDefaultData(db: Db, opts: SeedOptions = {}): Promise<SeedResult> {
  const log = opts.log || (() => {});
  const result: SeedResult = { lng: { inserted: 0, updated: 0 }, templates: { inserted: 0, updated: 0 } };

  // --- traduzioni ---
  const lngCol = db.collection("lng");
  const existingLng = new Map((await lngCol.find({}, { projection: { _id: 0 } }).toArray()).map((r: any) => [r.txt, r]));
  for (const [txt, values] of Object.entries(LNG)) {
    const existing: any = existingLng.get(txt);
    if (!existing) {
      const doc: Record<string, string> = { id: Guid.create().toString(), txt };
      for (const l of LANGS) doc[l] = values[l] ?? "";
      log(`+ lng ${txt}`);
      if (!opts.dryRun) await lngCol.insertOne(doc);
      result.lng.inserted++;
      continue;
    }
    const set: Record<string, string> = {};
    for (const l of LANGS) {
      const value = values[l];
      if (value === undefined) continue;
      // senza overwrite solo le lingue mai inserite (una stringa vuota e' una scelta dell'admin)
      if (opts.overwriteLng ? existing[l] !== value : existing[l] === undefined) set[l] = value;
    }
    if (!existing.id) set.id = Guid.create().toString();
    if (Object.keys(set).length > 0) {
      log(`~ lng ${txt} (${Object.keys(set).join(", ")})`);
      if (!opts.dryRun) await lngCol.updateOne({ txt }, { $set: set });
      result.lng.updated++;
    }
  }

  // --- template mail ---
  const tplCol = db.collection("templateMail");
  const existingTpl = new Map((await tplCol.find({}, { projection: { _id: 0 } }).toArray()).map((t: any) => [t.type, t]));
  for (const [type, tpl] of Object.entries(TEMPLATES)) {
    const existing: any = existingTpl.get(type);
    if (!existing) {
      log(`+ templateMail ${type}`);
      if (!opts.dryRun) await tplCol.insertOne({ type, title: tpl.title, body: tpl.body });
      result.templates.inserted++;
    } else if (opts.overwriteTemplates && (existing.title !== tpl.title || existing.body !== tpl.body)) {
      log(`~ templateMail ${type}`);
      if (!opts.dryRun) await tplCol.updateOne({ type }, { $set: { title: tpl.title, body: tpl.body } });
      result.templates.updated++;
    }
  }

  return result;
}
