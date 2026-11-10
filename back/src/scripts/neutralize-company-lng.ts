import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
import { neutralizeCompanyText } from "../i18n/neutralizeCompany";
import { LANGUAGE_CODE_RE } from "../i18n/languages";

dotenv.config({ path: ".env" });

/**
 * Toglie dalla collection lng i dati dell'azienda (vedi i18n/neutralizeCompany.ts):
 * nome -> {{company}}, ragione sociale -> {{companyLegalName}}, email -> {{companyEmail}},
 * indirizzo, telefoni e siti esterni rimossi. Il nome mostrato viene poi da COMPANY_NAME.
 *
 * Uso: npm run lng:neutralize -- [--dry-run] [--uri=<conn>]
 */
const args = process.argv.slice(2);
const uriArg = args.find((a) => a.startsWith("--uri="));
const connectionString = uriArg?.slice(6) || process.env.CONNECTION_STRING;
const dryRun = args.includes("--dry-run");

async function run() {
  if (!connectionString) {
    console.error("CONNECTION_STRING mancante (da .env o --uri=...)");
    process.exit(1);
  }
  const client = new MongoClient(connectionString, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  try {
    const col = client.db().collection("lng");
    const rows = await col.find({}).toArray();
    let changed = 0;
    for (const row of rows as any[]) {
      const set: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k === "txt" || k === "id" || !LANGUAGE_CODE_RE.test(k) || typeof v !== "string") continue;
        const n = neutralizeCompanyText(v, k);
        if (n !== v) set[k] = n;
      }
      if (Object.keys(set).length === 0) continue;
      changed++;
      console.log(`${dryRun ? "[dry-run] " : ""}~ ${row.txt} (${Object.keys(set).join(", ")})`);
      if (!dryRun) await col.updateOne({ _id: row._id }, { $set: set });
    }
    console.log(`${dryRun ? "[dry-run] " : ""}Chiavi ${dryRun ? "da modificare" : "modificate"}: ${changed} / ${rows.length} (database: ${client.db().databaseName})`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  });
}
