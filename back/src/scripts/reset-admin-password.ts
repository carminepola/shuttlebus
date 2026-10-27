import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

/**
 * Reset di emergenza della password di un amministratore (ROOT/ADMIN).
 *
 * NON e' un endpoint HTTP: si esegue solo con accesso shell al container,
 * che e' gia' la barriera di sicurezza (chi entra nel container legge anche
 * CONNECTION_STRING). La password non passa da log applicativi ne' da Seq.
 *
 * Effetti:
 *  - nuova password (generata casualmente se non passata con --password=)
 *  - revoca di TUTTE le sessioni attive dell'account
 *  - azzeramento dei contatori anti-bruteforce di login/2FA
 *  - con --reset-mfa: rimozione di app, email, passkey e codici di recupero
 *
 * Uso nel container (immagine di produzione, cwd /app):
 *   docker exec -it <container_back> node scripts/reset-admin-password.js --email=admin@dominio.it [--reset-mfa] [--password=...]
 * In sviluppo:
 *   npm run admin:resetPassword -- --email=admin@dominio.it
 */
const ROLE_ADMIN = 50; // enum role: ROOT = 1, ADMIN = 50

const args = process.argv.slice(2);
const arg = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const email = String(arg("email") || "").trim().toLowerCase();
const resetMfa = args.includes("--reset-mfa");
const passwordArg = arg("password");

function generatePassword(): string {
  // 16 caratteri base64url + cifra e lettera garantite (politica password: lettera + numero)
  return `${crypto.randomBytes(12).toString("base64url")}A7`;
}

async function run() {
  const connectionString = process.env.CONNECTION_STRING;
  if (!connectionString) {
    console.error("CONNECTION_STRING mancante nell'ambiente del container");
    process.exit(1);
  }
  if (!email) {
    console.error("Uso: node scripts/reset-admin-password.js --email=<email admin> [--reset-mfa] [--password=<nuova>]");
    process.exit(1);
  }
  if (passwordArg !== undefined && (passwordArg.length < 8 || !/^(?=.*[A-Za-z])(?=.*\d)/.test(passwordArg))) {
    console.error("La password deve avere almeno 8 caratteri, con almeno una lettera e un numero");
    process.exit(1);
  }

  const client = new MongoClient(connectionString);
  await client.connect();
  try {
    const db = client.db();
    const user = await db.collection("users").findOne({ email }, { projection: { _id: 1, email: 1, role: 1, disabled: 1 } });
    if (!user) {
      console.error(`Nessun utente con email ${email}`);
      process.exit(1);
    }
    if (typeof user.role !== "number" || user.role > ROLE_ADMIN) {
      console.error(`${email} non e' un amministratore (ruolo ${user.role}): reset rifiutato`);
      process.exit(1);
    }

    const password = passwordArg || generatePassword();
    await db.collection("users").updateOne(
      { _id: new ObjectId(user._id) },
      {
        $set: { password: bcrypt.hashSync(password, 10), sessions: [], updatedAt: Date.now() },
        $unset: { recoverPassword: "", recoverPasswordCount: "" },
      },
    );
    // contatori anti-bruteforce: login (email), 2FA (mfa:<userId>)
    await db.collection("failToBan").deleteMany({ ip: { $in: [email, `mfa:${String(user._id)}`] } });

    if (resetMfa) {
      await db.collection("user_mfa").deleteOne({ userId: String(user._id) });
    }

    console.log(`Password reimpostata per ${email} (sessioni revocate${resetMfa ? ", 2FA e passkey rimossi" : ""}).`);
    if (user.disabled) console.log("ATTENZIONE: l'account risulta disattivato (disabled=true): il login restera' bloccato.");
    if (!passwordArg) console.log(`Nuova password: ${password}`);
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
