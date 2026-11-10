import { MongoClient } from "mongodb";
import { Guid } from "guid-typescript";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config({ path: ".env" });

/**
 * Importa traduzioni da un file JSON nella collection 'lng'.
 *
 * Formato del file: { "<chiave>": { "it": "...", "en": "...", "fr": "...", "de": "...", "es": "...", "jp": "..." }, ... }
 * (i file delle varie funzionalita' stanno in src/scripts/lng/).
 *
 * - Chiave assente: inserita con un `id` (la pagina admin "Traduzioni" lavora per id).
 * - Chiave presente: le lingue del file sovrascrivono quelle salvate; con
 *   --only-missing vengono riempite solo le lingue vuote (le modifiche fatte
 *   dalla pagina admin restano).
 *
 * Uso:
 *   npm run lng:import -- src/scripts/lng/<file>.json [--dry-run] [--only-missing] [--uri=<conn>]
 *   Nel container (contiene solo dist/src, il JSON arriva da stdin):
 *   docker exec -i <container-back> node scripts/import-lng.js - < src/scripts/lng/<file>.json
 */

const LANGS = ["it", "en", "fr", "de", "es", "jp"] as const;

const args = process.argv.slice(2);
const uriArg = args.find((a) => a.startsWith("--uri="));
const connectionString = uriArg?.slice(6) || process.env.CONNECTION_STRING;
const dryRun = args.includes("--dry-run");
const onlyMissing = args.includes("--only-missing");
const file = args.find((a) => a === "-" || !a.startsWith("--"));

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Legge e controlla il JSON: oggetto chiave -> { lingua: testo }. */
function readKeys(source: string): Record<string, Record<string, string>> {
  const raw = source === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(source, "utf8");
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (error: any) {
    fail(`JSON non valido (${source}): ${error.message}`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) fail("Il JSON deve essere un oggetto { chiave: { it, en, ... } }");
  const keys: Record<string, Record<string, string>> = {};
  for (const [txt, values] of Object.entries<any>(data)) {
    if (!/^[A-Za-z0-9_.-]+$/.test(txt)) fail(`Chiave non valida: "${txt}"`);
    if (!values || typeof values !== "object" || Array.isArray(values)) fail(`Valore di "${txt}" non valido: atteso { it, en, ... }`);
    const unknown = Object.keys(values).filter((l) => !(LANGS as readonly string[]).includes(l));
    if (unknown.length) fail(`Lingue sconosciute in "${txt}": ${unknown.join(", ")}`);
    const clean: Record<string, string> = {};
    for (const lang of LANGS) {
      if (values[lang] === undefined) continue;
      if (typeof values[lang] !== "string") fail(`"${txt}.${lang}" deve essere una stringa`);
      clean[lang] = values[lang];
    }
    if (!clean.it) console.warn(`Attenzione: "${txt}" senza testo italiano`);
    keys[txt] = clean;
  }
  return keys;
}

async function run() {
  if (!file) fail("Indica il file JSON (o - per stdin). Uso: import-lng <file.json> [--dry-run] [--only-missing] [--uri=<conn>]");
  if (!connectionString) fail("CONNECTION_STRING mancante (da .env o --uri=...)");
  const keys = readKeys(file);

  const client = new MongoClient(connectionString);
  await client.connect();
  const col = client.db().collection("lng");
  const prefix = dryRun ? "[dry-run] " : "";
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;

  try {
    for (const [txt, values] of Object.entries(keys)) {
      const existing: any = await col.findOne({ txt });
      if (!existing) {
        const doc: Record<string, string> = { id: Guid.create().toString(), txt };
        for (const lang of LANGS) doc[lang] = values[lang] || "";
        console.log(`${prefix}+ ${txt}`);
        if (!dryRun) await col.insertOne(doc);
        inserted++;
        continue;
      }

      const set: Record<string, string> = {};
      for (const [lang, text] of Object.entries(values)) {
        if (onlyMissing && existing[lang]) continue;
        if (existing[lang] !== text) set[lang] = text;
      }
      if (!existing.id) set.id = Guid.create().toString();
      if (Object.keys(set).length === 0) {
        unchanged++;
        continue;
      }
      console.log(`${prefix}~ ${txt} (${Object.keys(set).join(", ")})`);
      if (!dryRun) await col.updateOne({ txt }, { $set: set });
      updated++;
    }
  } finally {
    await client.close();
  }

  console.log(`${prefix}Inserite ${inserted} · aggiornate ${updated} · invariate ${unchanged} / ${Object.keys(keys).length} chiavi`);
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
