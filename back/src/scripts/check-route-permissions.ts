/**
 * CI checker: verifica che le API rispettino la matrice dei permessi.
 * Analizza staticamente back/src/api/*.ts e segnala:
 *   1. ERROR: endpoint mutanti (POST/PUT/PATCH/DELETE) senza authMiddleware,
 *      a meno che non siano nelle liste PLUBLIC/AUTH_ONLY dichiarate qui sotto
 *      con giustificazione (login, registrazione, webhook firmato, ecc.).
 *   2. ERROR: endpoint mutanti con auth ma SENZA checkPermissionMiddleware
 *      quando non in AUTH_ONLY (le rotte di amministrazione devono dichiarare il ruolo).
 *   3. WARN (solo report): GET senza auth (pubblico e' legit in alcuni casi,
 *      la lista viene stampata per review umana).
 *
 * Uso:  npm run ci:permissions
 * Exit: 0 se nessun errore; 1 se trovati errori (blocca CI).
 */
import fs from "fs";
import path from "path";

const API_DIR = path.resolve(__dirname, "../api");

/** Endpoint pubblici legittimi: (file, path) ESATTI consentiti senza authMiddleware. */
const PUBLIC_MUTATIONS: Record<string, Record<string, string>> = {
  "sessions.ts": {
    "POST /": "login (rate-limited per IP/account)",
    "POST /recoverPassword": "rate-limited, token opaco (enumeration-safe)",
    "POST /resetPassword": "rate-limited, token opaco una-tantum",
    "POST /mfa/email": "rate-limited, richiede ticket MFA firmato (password gia' verificata)",
    "POST /mfa/verify": "secondo fattore: ticket MFA firmato + anti-bruteforce per utente",
    "POST /passkey/options": "rate-limited, genera solo una challenge WebAuthn monouso",
    "POST /passkey/verify": "login passkey: autenticato dalla firma WebAuthn + challenge monouso",
  },
  "users.ts": {
    "POST /register": "registrazione (rate-limited + politica password)",
    "POST /validateEmail": "validazione PIN (rate-limited + anti-bruteforce PIN)",
  },
  "booking.ts": {
    "POST /findAvailableRoutes": "ricerca disponibilita' pubblica (read-only interna)",
  },
  "stripeWebhook.ts": {
    "POST /webhook": "webhook Stripe: autenticato dalla FIRMA (sig) + WEBHOOK_SECRET, non da cookie",
  },
  "momap.ts": {
    "POST /cron": "fail-closed: IP whitelist + x-cron-secret (non e' auth a cookie)",
  },
  "exemple.ts": {
    "POST /": "router scaffold NON montato in api/index.ts (template di esempio)",
  },
};

/** Mutazioni che per design NON devono avere checkPermissionMiddleware (solo auth): proprieta' utente. */
const AUTH_ONLY_MUTATIONS: Record<string, Record<string, string>> = {
  "users.ts": {
    "PATCH /changePassword": "proprietario (email dal token)",
    "PATCH /updateDetails": "proprietario",
    "PUT /updateOptions": "proprietario (whitelist campi)",
    "DELETE /": "logout",
    "DELETE /all": "logout sessioni",
    "PATCH /terms": "proprietario",
    "POST /deleteAccount/start": "proprietario (userId dal token)",
    "POST /deleteAccount": "proprietario + codice di conferma (app/recupero o email)",
  },
  "sessions.ts": {
    "DELETE /": "logout",
    "DELETE /all": "logout sessioni",
    "PATCH /terms": "proprietario",
  },
  "mfa.ts": {
    "POST /totp/setup": "proprietario (userId dal token)",
    "POST /totp/enable": "proprietario + codice app",
    "POST /totp/disable": "proprietario + codice app",
    "POST /email/send": "proprietario (email dal token)",
    "POST /email/enable": "proprietario + codice email",
    "POST /email/disable": "proprietario + codice email",
    "POST /recovery/regenerate": "proprietario + codice di un fattore attivo",
    "POST /passkey/options": "proprietario",
    "POST /passkey/verify": "proprietario + challenge monouso",
    "DELETE /passkey/:id": "proprietario (pull filtrato per userId)",
  },
  "booking.ts": {
    "POST /insertBooking": "proprietario (userId dal token)",
    "POST /refundBooking": "ownership check + admin check interni",
    "POST /deleteBooking": "ownership check + admin check interni",
  },
  "stripe.ts": {
    "POST /delete": "proprietario (ownership check interno)",
    "POST /refund": "owner-or-admin check interno + claim atomico",
    "DELETE /savedCards/:id": "proprietario (customer dal token, carta verificata sul customer)",
  },
};

type Route = {
  file: string;
  method: string;
  path: string;
  hasAuth: boolean;
  hasCheckPermission: boolean;
  snippet: string;
};

function extractPathRoute(call: string): string {
  const m = call.match(/router\.\w+\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/);
  return m ? m[1] || m[2] || m[3] || "" : "";
}

/** Ricava la lista delle rotte di un file con i flag di sicurezza dichiarati. */
function parseRoutes(file: string, content: string): Route[] {
  const routes: Route[] = [];
  const re = /router\.(get|post|put|patch|delete)\(/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const routePath = extractPathRoute(content.slice(match.index, match.index + 200));
    // chunk fino alla chiamata "router." successiva o fine file
    const nextIdx = content.indexOf("router.", match.index + 10);
    const chunk = content.slice(match.index, nextIdx === -1 ? content.length : nextIdx);
    const hasAuth = /authMiddleware/.test(chunk);
    const hasCheckPermission = /checkPermissionMiddleware/.test(chunk);
    routes.push({ file, method, path: routePath, hasAuth, hasCheckPermission, snippet: chunk.slice(0, 80).replace(/\s+/g, " ") });
  }
  return routes;
}

function routeKey(method: string, routePath: string): string {
  // rotte tipo "/:id" vengono normalizzate: mergiamo su una entry
  return `${method} ${routePath.replace(/:(\w+)/g, ":param")}`;
}

let errors = 0;
let warnings = 0;
const report: string[] = [];

for (const file of fs.readdirSync(API_DIR).filter((f) => f.endsWith(".ts")).sort()) {
  const content = fs.readFileSync(path.join(API_DIR, file), "utf8");
  for (const route of parseRoutes(file, content)) {
    const key = routeKey(route.method, route.path);
    const publicReason = (PUBLIC_MUTATIONS[file] || {})[`${route.method} ${route.path}`];
    const authOnlyReason = (AUTH_ONLY_MUTATIONS[file] || {})[`${route.method} ${route.path}`];

    if (["POST", "PUT", "PATCH", "DELETE"].includes(route.method)) {
      if (!route.hasAuth) {
        if (publicReason) {
          report.push(`OK-PUBLIC   ${file.padEnd(22)} ${key.padEnd(30)} (${publicReason})`);
        } else {
          report.push(`ERROR!!!    ${file.padEnd(22)} ${key.padEnd(30)} -> MUTAZIONE SENZA authMiddleware e non in lista pubblica consentita`);
          errors++;
        }
      } else if (!route.hasCheckPermission) {
        if (authOnlyReason) {
          report.push(`OK-AUTHONLY ${file.padEnd(22)} ${key.padEnd(30)} (${authOnlyReason})`);
        } else {
          // mutante autenticato ma senza ruoli dichiarati: le aree admin/driver
          // devono dichiarare checkPermission; segnalato come ERROR. La deviazione
          // repo<->prod (es. readBookingById) nasce proprio da queste omissioni.
          report.push(`ERROR!!!    ${file.padEnd(22)} ${key.padEnd(30)} -> auth SENZA checkPermissionMiddleware e non in lista AUTH_ONLY consentita`);
          errors++;
        }
      } else {
        report.push(`OK-SECURED  ${file.padEnd(22)} ${key.padEnd(30)}`);
      }
    } else {
      // GET: solo report (i GET possono essere pubblici in modo legittimo)
      if (!route.hasAuth) {
        report.push(`WARN-GET-NOAUTH ${file.padEnd(22)} ${key.padEnd(30)} GET pubblico: verifica che non esponga dati sensibili`);
        warnings++;
      } else {
        report.push(`OK-GET      ${file.padEnd(22)} ${key.padEnd(30)}`);
      }
    }
  }
}

console.log(`\n=== MATRICE PERMESSI API (back/src/api) ===\n`);
for (const line of report) console.log(line);
console.log(`\nTotale errori: ${errors} / warning: ${warnings}`);
if (errors > 0) {
  console.error(`\nFAIL: ${errors} problemi di permissione. Correggi o aggiorna le liste consentite con giustificazione.`);
  process.exit(1);
}
console.log("PASS: nessuna rotta mutante fuori matrice.");