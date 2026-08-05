import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const connectionString = process.env.CONNECTION_STRING;
if (!connectionString) {
  console.error("CONNECTION_STRING mancante nel file .env");
  process.exit(1);
}

// Chiavi 'txt' note come corrotte (mash-up di altre chiavi) da rimuovere.
const MANGLED_TXT = [
  "str_arrivstr_seleziona_biglietti_per_acquistoo_a",
];

/**
 * Pulizia della collection 'lng':
 *  1) elimina i documenti con chiave 'txt' corrotta (mangled)
 *  2) deduplica le chiavi 'txt' ripetute tenendo il documento migliore
 *     (piu' campi lingua compilati, piu' vecchio in caso di parita')
 *  3) crea l'indice unico su 'txt'
 *
 * Idempotente: puo' essere rieseguito senza effetti collaterali.
 */
async function run() {
  const client = new MongoClient(connectionString!);
  await client.connect();
  const db = client.db();
  const col = db.collection("lng");

  const before = await col.estimatedDocumentCount();
  console.log(`Documenti iniziali: ${before}`);

  // 1) Rimozione chiavi corrotte
  for (const txt of MANGLED_TXT) {
    const r = await col.deleteMany({ txt });
    console.log(`- Rimossi ${r.deletedCount} documenti con chiave corrotta: "${txt}"`);
  }

  // 2) Deduplica: raggruppa per txt, per ogni gruppo con piu' di 1 doc
  //    tiene il "migliore" ed elimina gli altri.
  const groups: { _id: string; ids: any[] }[] = await col
    .aggregate<{ _id: string; ids: any[] }>([
      { $group: { _id: "$txt", ids: { $push: "$_id" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  let removedDups = 0;
  for (const g of groups) {
    const docs = await col.find({ _id: { $in: g.ids } }).toArray();

    // Punteggio: numero di campi lingua non vuoti (it,en,fr,de,es,jp)
    const score = (d: any) =>
      ["it", "en", "fr", "de", "es", "jp"].filter(
        (l) => d[l] !== undefined && d[l] !== null && String(d[l]).trim() !== "",
      ).length;

    // Ordina: punteggio desc, poi _id asc (piu' vecchio prima) per stabilita'
    docs.sort((a, b) => {
      const s = score(b) - score(a);
      if (s !== 0) return s;
      return String(a._id.getTimestamp()).localeCompare(String(b._id.getTimestamp()));
    });

    const keep = docs[0];
    const toDelete = docs.slice(1).map((d) => d._id);
    const r = await col.deleteMany({ _id: { $in: toDelete } });
    removedDups += r.deletedCount;
    console.log(
      `- txt duplicata "${g._id}": tenuto ${keep.id}, rimossi ${r.deletedCount}`,
    );
  }
  console.log(`Totale duplicati rimossi: ${removedDups}`);

  // 3) Indice unico su txt
  try {
    await col.createIndex({ txt: 1 }, { unique: true, name: "uniq_txt" });
    console.log("Indice unico su 'lng.txt' creato correttamente.");
  } catch (error: any) {
    console.error("Creazione indice fallita:", error?.message || error);
  }

  const after = await col.estimatedDocumentCount();
  console.log(`Documenti finali: ${after} (rimossi ${before - after})`);

  await client.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
