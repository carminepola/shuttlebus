import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";
import { seedDefaultData } from "../components/services/defaultDataServices";

dotenv.config({ path: ".env" });

/**
 * Allinea il DB alle traduzioni versionate (src/data/lng.json).
 * Senza opzioni fa quello che fa gia' l'avvio del back: inserisce solo cio' che manca.
 *
 *   --overwrite-lng        sovrascrive le traduzioni con quelle del file
 *   --dry-run              mostra cosa cambierebbe senza scrivere
 *   --uri=<conn>           connection string (default: CONNECTION_STRING del .env)
 *
 * Uso: npm run data:sync -- [--overwrite-lng] [--dry-run] [--uri=<conn>]
 * Nel container: node scripts/sync-default-data.js [opzioni]
 */

const args = process.argv.slice(2);
const uriArg = args.find((a) => a.startsWith("--uri="));
const connectionString = uriArg?.slice(6) || process.env.CONNECTION_STRING;

async function run() {
  if (!connectionString) {
    console.error("CONNECTION_STRING mancante (da .env o --uri=...)");
    process.exit(1);
  }
  const dryRun = args.includes("--dry-run");
  const client = new MongoClient(connectionString);
  await client.connect();
  try {
    const res = await seedDefaultData(client.db(), {
      overwriteLng: args.includes("--overwrite-lng"),
      dryRun,
      log: (m) => console.log((dryRun ? "[dry-run] " : "") + m),
    });
    console.log(
      `${dryRun ? "[dry-run] " : ""}Traduzioni: inserite ${res.lng.inserted}, aggiornate ${res.lng.updated}`,
    );
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
