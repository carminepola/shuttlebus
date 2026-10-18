import { MongoClient } from "mongodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

// La connection string puo' arrivare da .env oppure da env esterno / --uri=
const args = process.argv.slice(2);
const uriArg = args.find((a) => a.startsWith("--uri="));
const connectionString = uriArg?.slice(6) || process.env.CONNECTION_STRING;
if (!connectionString) {
  console.error("CONNECTION_STRING mancante (richiedeva da .env o --uri=...)", );
  process.exit(1);
}
const dryRun = args.includes("--dry-run");

/**
 * Migrazione one-off (pentest #7): aggiorna i template mail RECOVER_PASSWORD
 * (e tutte le varianti lingua) passando dal vecchio flusso
 * {password} in chiaro al nuovo flusso a token: link {url} monouso con
 * scadenza 30 minuti, puntato a /reset-password.
 *
 * Variabili usate dal template: {name}, {mail}, {url}, {img}
 * La variabile {password} NON viene piu' popolata dal codice: qualsiasi
 * riferimento residuo verrebbe lasciato come testo "{password}" nella mail.
 *
 * Idempotente: puo' essere rieseguito senza effetti collaterali.
 * Uso: ts-node src/scripts/update-recover-password-template.ts [--dry-run] [--uri=<conn>]
 */

const FOOTER = `<div style="text-align: center; font-size: 12px; color: #666666; padding: 15px; background-color: #fafafa; border-top: 1px solid #dddddd;">
    <p>Pintour S.C.A.R.L.<br>
      Registered office: Via Castellammare 18, 80050, Pimonte (Na)<br>
      Head office: Via Mariconda 39, 80045, Pompei (Na)<br>
      VAT Number 06565461214<br>
      <a href="tel:+390818792645" style="color: #f52b74; text-decoration: none;">+39 0818792645</a>
    </p>
  </div>`;

function buildBody(header: { title: string; greeting: string; intro: string; button: string; validity: string; ignore: string; linkFallback: string }): string {
  return `<div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1); font-family: Arial, sans-serif;">
 <div style="background-color: #fff; color: #ffffff; padding: 20px; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; text-transform: uppercase;">
      <img src="{img}" style="height:50px"/>
    </h1>
  </div>
  <div style="padding: 20px; color: #333333;">
    <h2>${header.title}</h2>
    <p>${header.greeting}</p>
    <p>${header.intro}</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{url}" style="display: inline-block; background-color: #f52b74; color: #ffffff; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; font-size: 16px;">${header.button}</a>
    </div>
    <p style="font-size: 12px; color: #666666; word-break: break-all;">${header.linkFallback} <a href="{url}" style="color: #f52b74; text-decoration: none;">{url}</a></p>
    <p><strong>${header.validity}</strong></p>
    <p>${header.ignore}</p>
  </div>
  ${FOOTER}
</div>`;
}

const TEMPLATES: { types: string[]; title: string; body: string }[] = [
  {
    types: ["RECOVER_PASSWORD"],
    title: "Reimposta la tua password",
    body: buildBody({
      title: "Reimposta la tua password",
      greeting: "Ciao {name},",
      intro: "Abbiamo ricevuto una richiesta di reimpostazione della password per l'account <strong>{mail}</strong>. Clicca sul pulsante qui sotto scegliere una nuova password.",
      button: "Reimposta password",
      validity: "Il link è valido per 30 minuti e può essere usato una sola volta.",
      ignore: "Se non sei stato tu a richiedere questa email, puoi ignorarla in sicurezza: la tua password resta invariata.",
      linkFallback: "Se il pulsante non funziona, copia e incolla questo link nel browser:",
    }),
  },
  {
    types: ["RECOVER_PASSWORD_EN"],
    title: "Reset your password",
    body: buildBody({
      title: "Reset your password",
      greeting: "Hello {name},",
      intro: "We received a request to reset the password for the account <strong>{mail}</strong>. Click the button below to choose a new password.",
      button: "Reset password",
      validity: "The link is valid for 30 minutes and can be used once only.",
      ignore: "If you did not request this email, you can safely ignore it: your password stays unchanged.",
      linkFallback: "If the button does not work, copy and paste this link into your browser:",
    }),
  },
  {
    types: ["RECOVER_PASSWORD_FR"],
    title: "Réinitialisez votre mot de passe",
    body: buildBody({
      title: "Réinitialisez votre mot de passe",
      greeting: "Bonjour {name},",
      intro: "Nous avons reçu une demande de réinitialisation du mot de passe pour le compte <strong>{mail}</strong>. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.",
      button: "Réinitialiser le mot de passe",
      validity: "Le lien est valable 30 minutes et ne peut être utilisé qu'une seule fois.",
      ignore: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message en toute sécurité : votre mot de passe reste inchangé.",
      linkFallback: "Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :",
    }),
  },
  {
    types: ["RECOVER_PASSWORD_DE"],
    title: "Setze dein Passwort zurück",
    body: buildBody({
      title: "Setze dein Passwort zurück",
      greeting: "Hallo {name},",
      intro: "Wir haben eine Anfrage zum Zurücksetzen des Passworts für das Konto <strong>{mail}</strong> erhalten. Klicke auf die Schaltfläche unten, um ein neues Passwort festzulegen.",
      button: "Passwort zurücksetzen",
      validity: "Der Link ist 30 Minuten gültig und kann nur einmal verwendet werden.",
      ignore: "Wenn du diese E-Mail nicht angefordert hast, kannst du sie getrost ignorieren: dein Passwort bleibt unverändert.",
      linkFallback: "Falls die Schaltfläche nicht funktioniert, kopiere diesen Link in deinen Browser:",
    }),
  },
  {
    types: ["RECOVER_PASSWORD_ES"],
    title: "Restablece tu contraseña",
    body: buildBody({
      title: "Restablece tu contraseña",
      greeting: "Hola {name},",
      intro: "Hemos recibido una solicitud para restablecer la contraseña de la cuenta <strong>{mail}</strong>. Haz clic en el botón de abajo para elegir una nueva contraseña.",
      button: "Restablecer contraseña",
      validity: "El enlace es válido durante 30 minutos y solo puede usarse una vez.",
      ignore: "Si no has solicitado este correo, puedes ignorarlo con seguridad: tu contraseña no cambia.",
      linkFallback: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
    }),
  },
  {
    types: ["RECOVER_PASSWORD_JP"],
    title: "パスワードの再設定",
    body: buildBody({
      title: "パスワードの再設定",
      greeting: "{name} 様、",
      intro: "アカウント <strong>{mail}</strong> のパスワード再設定のリクエストを受け付けました。下のボタンから新しいパスワードを設定してください。",
      button: "パスワードを再設定",
      validity: "このリンクの有効期限は30分で、使用は1回限りです。",
      ignore: "ご本人様によるリクエストでない場合は、このメールを破棄していただいて構いません。パスワードは変更されません。",
      linkFallback: "ボタンが機能しない場合は、以下のリンクをブラウザにコピーして貼り付けてください：",
    }),
  },
];

async function run(): Promise<void> {
  const client: MongoClient = new MongoClient(connectionString!, {
    serverSelectionTimeoutMS: 10000,
  });
  await client.connect();
  const col = client.db().collection("templateMail");

  for (const t of TEMPLATES) {
    for (const type of t.types) {
      const existing = await col.findOne({ type: type });
      if (existing) {
        if (!existing.body || !existing.body.includes("{password}")) {
          console.log(`- ${type}: gia' aggiornato o senza {password}, skip`);
          continue;
        }
      }
      if (dryRun) {
        console.log(`[DRY] ${type}: titolo="${t.title}", body ok ({url}, nessun {password})`);
        continue;
      }
      const res = await col.updateOne(
        { type: type },
        { $set: { type: type, title: t.title, body: t.body } },
        { upsert: true }
      );
      console.log(`✔ ${type}: aggiornato (matched=${res.matchedCount}, upserted=${res.upsertedCount ? res.upsertedId : ""})`);
    }
  }

  await client.close();
  console.log(
    `Completata. Il template ora contiene SOLO la variabile {url}: nessuna password via mail. Rimuovere da email/pannello admin qualunque uso di {password}.`
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
