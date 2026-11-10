import { Db } from "mongodb";
import { Guid } from "guid-typescript";
import lngData from "../../data/lng.json";

/**
 * Traduzioni di base, versionate in src/data/lng.json ({ chiave: { <lingua>: testo } }):
 * testi dell'app e delle mail (le mail sono tipi standard in mail/mailTypes.ts).
 * Il nome dell'azienda e' un segnaposto (vedi utils/company.ts).
 *
 * All'avvio (seedDefaultData senza opzioni) un DB nuovo riceve tutto e uno
 * esistente solo cio' che manca: chiavi assenti e lingue mai inserite. I testi
 * gia' presenti, anche modificati dall'admin, restano. overwriteLng (script
 * sync-default-data) li sovrascrive con il file.
 */

export interface SeedOptions {
  overwriteLng?: boolean;
  dryRun?: boolean;
  log?: (message: string) => void;
}

export interface SeedResult {
  lng: { inserted: number; updated: number };
}

const LNG = lngData as Record<string, Record<string, string>>;

export async function seedDefaultData(db: Db, opts: SeedOptions = {}): Promise<SeedResult> {
  const log = opts.log || (() => {});
  const result: SeedResult = { lng: { inserted: 0, updated: 0 } };

  const lngCol = db.collection("lng");
  const existingLng = new Map((await lngCol.find({}, { projection: { _id: 0 } }).toArray()).map((r: any) => [r.txt, r]));
  for (const [txt, values] of Object.entries(LNG)) {
    const existing: any = existingLng.get(txt);
    if (!existing) {
      const doc: Record<string, string> = { id: Guid.create().toString(), txt, ...values };
      log(`+ lng ${txt}`);
      if (!opts.dryRun) await lngCol.insertOne(doc);
      result.lng.inserted++;
      continue;
    }
    const set: Record<string, string> = {};
    for (const [l, value] of Object.entries(values)) {
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

  return result;
}
