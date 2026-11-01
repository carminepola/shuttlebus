import { MongoClient } from "mongodb";
import { Guid } from "guid-typescript";
import * as dotenv from "dotenv";
import { KEYS as SEED_KEYS } from "./seed-mfa-lng";
import { TEMPLATES as RECOVER_TEMPLATES } from "./update-recover-password-template";

dotenv.config({ path: ".env" });

// La connection string puo' arrivare da .env oppure da env esterno / --uri=
const args = process.argv.slice(2);
const uriArg = args.find((a) => a.startsWith("--uri="));
const connectionString = uriArg?.slice(6) || process.env.CONNECTION_STRING;
if (!connectionString) {
  console.error("CONNECTION_STRING mancante (richiedeva da .env o --uri=...)");
  process.exit(1);
}
const dryRun = args.includes("--dry-run");

/**
 * Pre-release produzione (nov 2026):
 *
 * 1) lng: inserisce le chiavi usate dal codice ma assenti in produzione.
 *    - 89 chiavi gia' presenti in seed-mfa-lng.ts (MFA, passkey, carta salvata,
 *      eliminazione account, PWA, andata/ritorno, rimborsi, sicurezza...)
 *    - 31 chiavi qui sotto (errori backend, reset password, pagamento in verifica...)
 *    Chiave presente: vengono riempite SOLO le lingue vuote/assenti, mai
 *    sovrascritte le traduzioni modificate dalla pagina admin "Traduzioni".
 *
 * 2) lng: completa le lingue vuote di str_vuoi_cancellare.
 *    (str_alert resta vuota di proposito: banner home nascosto.)
 *
 * 3) templateMail: applica la migrazione RECOVER_PASSWORD (passaggio da
 *    {password} in chiaro al link monouso {url}) mai eseguita in produzione:
 *    i 6 template RECOVER_PASSWORD* contengono ancora {password}, variabile
 *    che il codice non popola piu'.
 *
 * Idempotente: puo' essere rieseguito senza effetti collaterali.
 * Uso: ts-node src/scripts/pre-release-lng-mail.ts [--dry-run] [--uri=<conn>]
 */
const LANGS = ["it", "en", "fr", "de", "es", "jp"] as const;
type Translation = Record<(typeof LANGS)[number], string>;

const EXTRA_KEYS: Record<string, Translation> = {
  str_awaiting_payment_confirmation: {
    it: "In attesa di conferma pagamento",
    en: "Awaiting payment confirmation",
    fr: "En attente de confirmation du paiement",
    de: "Warten auf Zahlungsbestätigung",
    es: "Pendiente de confirmación del pago",
    jp: "決済確認待ち",
  },
  str_err_data: {
    it: "Seleziona una data",
    en: "Select a date",
    fr: "Sélectionnez une date",
    de: "Wähle ein Datum",
    es: "Selecciona una fecha",
    jp: "日付を選択してください",
  },
  str_error_bad_request: {
    it: "Richiesta non valida",
    en: "Invalid request",
    fr: "Requête invalide",
    de: "Ungültige Anfrage",
    es: "Solicitud no válida",
    jp: "リクエストが無効です",
  },
  str_error_payload_too_large: {
    it: "Dati inviati troppo grandi",
    en: "Submitted data too large",
    fr: "Données envoyées trop volumineuses",
    de: "Gesendete Daten zu groß",
    es: "Datos enviados demasiado grandes",
    jp: "送信データが大きすぎます",
  },
  str_error_permission: {
    it: "Non hai i permessi per questa operazione",
    en: "You do not have permission to perform this operation",
    fr: "Vous n'avez pas les droits pour cette opération",
    de: "Du hast keine Berechtigung für diesen Vorgang",
    es: "No tienes permisos para esta operación",
    jp: "この操作を行う権限がありません",
  },
  str_error_refund: {
    it: "Impossibile elaborare il rimborso",
    en: "Unable to process the refund",
    fr: "Impossible de traiter le remboursement",
    de: "Rückerstattung kann nicht verarbeitet werden",
    es: "No se puede procesar el reembolso",
    jp: "返金を処理できません",
  },
  str_insert_email_to_receive_reset_link: {
    it: "Inserisci la tua email per ricevere il link di reimpostazione",
    en: "Enter your email to receive the reset link",
    fr: "Saisissez votre e-mail pour recevoir le lien de réinitialisation",
    de: "Gib deine E-Mail-Adresse ein, um den Reset-Link zu erhalten",
    es: "Introduce tu correo para recibir el enlace de restablecimiento",
    jp: "再設定リンクを受け取るにはメールアドレスを入力してください",
  },
  str_login_success: {
    it: "Login riuscito!",
    en: "Signed in successfully!",
    fr: "Connexion réussie !",
    de: "Anmeldung erfolgreich!",
    es: "¡Sesión iniciada correctamente!",
    jp: "ログインしました!",
  },
  str_not_before_3_days: {
    it: "Il rimborso è possibile fino a 3 giorni prima della partenza",
    en: "Refunds are possible up to 3 days before departure",
    fr: "Le remboursement est possible jusqu'à 3 jours avant le départ",
    de: "Eine Rückerstattung ist bis 3 Tage vor Abfahrt möglich",
    es: "El reembolso es posible hasta 3 días antes de la salida",
    jp: "出発の3日前まで返金できます",
  },
  str_not_ticket_expired: {
    it: "Il viaggio è già passato: rimborso non disponibile",
    en: "The trip has already taken place: refund not available",
    fr: "Le voyage a déjà eu lieu : remboursement non disponible",
    de: "Die Fahrt hat bereits stattgefunden: Rückerstattung nicht möglich",
    es: "El viaje ya ha pasado: reembolso no disponible",
    jp: "すでに乗車済みのため返金できません",
  },
  str_pagamento_in_verifica: {
    it: "Pagamento in verifica",
    en: "Payment under verification",
    fr: "Paiement en cours de vérification",
    de: "Zahlung wird geprüft",
    es: "Pago en verificación",
    jp: "決済確認中",
  },
  str_pagamento_in_verifica_desc: {
    it: "Abbiamo ricevuto il tuo pagamento e stiamo attendendo la conferma.",
    en: "We received your payment and are waiting for confirmation.",
    fr: "Nous avons reçu votre paiement et attendons la confirmation.",
    de: "Wir haben deine Zahlung erhalten und warten auf die Bestätigung.",
    es: "Hemos recibido tu pago y estamos esperando la confirmación.",
    jp: "お支払いを受け付けました。確認をお待ちください。",
  },
  str_pagamento_in_verifica_desc2: {
    it: "Puoi riprovare la verifica o controllare lo stato nella sezione dei tuoi biglietti.",
    en: "You can retry the verification or check the status in your tickets section.",
    fr: "Vous pouvez relancer la vérification ou consulter le statut dans la section de vos billets.",
    de: "Du kannst die Prüfung wiederholen oder den Status im Bereich deiner Tickets prüfen.",
    es: "Puedes reintentar la verificación o consultar el estado en la sección de tus billetes.",
    jp: "確認を再試行するか、マイチケットで状況をご確認ください。",
  },
  str_password_confirm: {
    it: "Ripeti password",
    en: "Repeat password",
    fr: "Répéter le mot de passe",
    de: "Passwort wiederholen",
    es: "Repite la contraseña",
    jp: "パスワード（確認用）",
  },
  str_password_min8: {
    it: "La password deve avere almeno 8 caratteri",
    en: "Password must be at least 8 characters",
    fr: "Le mot de passe doit contenir au moins 8 caractères",
    de: "Das Passwort muss mindestens 8 Zeichen haben",
    es: "La contraseña debe tener al menos 8 caracteres",
    jp: "パスワードは8文字以上で入力してください",
  },
  str_password_mismatch: {
    it: "Le password non coincidono",
    en: "Passwords do not match",
    fr: "Les mots de passe ne correspondent pas",
    de: "Die Passwörter stimmen nicht überein",
    es: "Las contraseñas no coinciden",
    jp: "パスワードが一致しません",
  },
  str_payment_failed: {
    it: "Pagamento non riuscito",
    en: "Payment failed",
    fr: "Paiement échoué",
    de: "Zahlung fehlgeschlagen",
    es: "Pago fallido",
    jp: "決済に失敗しました",
  },
  str_pending_payment: {
    it: "In attesa di pagamento",
    en: "Awaiting payment",
    fr: "En attente de paiement",
    de: "Zahlung ausstehend",
    es: "Pendiente de pago",
    jp: "お支払い待ち",
  },
  str_refund_error: {
    it: "Errore durante il rimborso",
    en: "Error during refund",
    fr: "Erreur lors du remboursement",
    de: "Fehler bei der Rückerstattung",
    es: "Error durante el reembolso",
    jp: "返金処理中にエラーが発生しました",
  },
  str_refund_exceeds_count: {
    it: "Numero di biglietti da rimborsare non valido",
    en: "Invalid number of tickets to refund",
    fr: "Nombre de billets à rembourser non valide",
    de: "Ungültige Anzahl zu erstattender Tickets",
    es: "Número de billetes a reembolsar no válido",
    jp: "返金するチケットの数が無効です",
  },
  str_refund_exceeds_luggage: {
    it: "Numero di bagagli da rimborsare non valido",
    en: "Invalid number of luggage items to refund",
    fr: "Nombre de bagages à rembourser non valide",
    de: "Ungültige Anzahl zu erstattender Gepäckstücke",
    es: "Número de equipajes a reembolsar no válido",
    jp: "返金する荷物の数が無効です",
  },
  str_refund_invalid_booking: {
    it: "Prenotazione non valida per il rimborso",
    en: "Booking not valid for refund",
    fr: "Réservation non valide pour le remboursement",
    de: "Buchung nicht für Rückerstattung gültig",
    es: "Reserva no válida para el reembolso",
    jp: "この予約は返金できません",
  },
  str_refund_invalid_ticket: {
    it: "Tipo di biglietto non valido per il rimborso",
    en: "Ticket type not valid for refund",
    fr: "Type de billet non valide pour le remboursement",
    de: "Tickettyp nicht für Rückerstattung gültig",
    es: "Tipo de billete no válido para el reembolso",
    jp: "このチケット種別は返金できません",
  },
  str_refund_no_items: {
    it: "Seleziona almeno un biglietto o bagaglio da rimborsare",
    en: "Select at least one ticket or luggage item to refund",
    fr: "Sélectionnez au moins un billet ou bagage à rembourser",
    de: "Wähle mindestens ein Ticket oder Gepäckstück zur Erstattung aus",
    es: "Selecciona al menos un billete o equipaje para reembolsar",
    jp: "返金するチケットまたは荷物を1つ以上選択してください",
  },
  str_reset_link_sent: {
    it: "Se l'email esiste, ti abbiamo inviato il link per reimpostare la password",
    en: "If the email exists, we have sent you the password reset link",
    fr: "Si l'e-mail existe, nous vous avons envoyé le lien de réinitialisation",
    de: "Falls die E-Mail existiert, haben wir dir den Reset-Link gesendet",
    es: "Si el correo existe, te hemos enviado el enlace de restablecimiento",
    jp: "メールアドレスが登録されている場合、再設定リンクを送信しました",
  },
  str_reset_password_desc: {
    it: "Inserisci la tua email e ti invieremo un link per reimpostare la password",
    en: "Enter your email and we will send you a link to reset your password",
    fr: "Saisissez votre e-mail et nous vous enverrons un lien pour réinitialiser votre mot de passe",
    de: "Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen des Passworts",
    es: "Introduce tu correo y te enviaremos un enlace para restablecer la contraseña",
    jp: "メールアドレスを入力すると、パスワード再設定リンクをお送りします",
  },
  str_reset_password_ok: {
    it: "Password reimpostata correttamente",
    en: "Password reset successfully",
    fr: "Mot de passe réinitialisé avec succès",
    de: "Passwort erfolgreich zurückgesetzt",
    es: "Contraseña restablecida correctamente",
    jp: "パスワードを再設定しました",
  },
  str_reset_token_invalid: {
    it: "Token scaduto o non valido",
    en: "Token expired or invalid",
    fr: "Jeton expiré ou non valide",
    de: "Token abgelaufen oder ungültig",
    es: "Token caducado o no válido",
    jp: "トークンの有効期限が切れているか無効です",
  },
  str_riprova: {
    it: "Riprova",
    en: "Try again",
    fr: "Réessayer",
    de: "Erneut versuchen",
    es: "Reintentar",
    jp: "再試行",
  },
  str_too_many_requests: {
    it: "Troppe richieste",
    en: "Too many requests",
    fr: "Trop de requêtes",
    de: "Zu viele Anfragen",
    es: "Demasiadas solicitudes",
    jp: "リクエストが多すぎます",
  },
  str_too_many_requests_desc: {
    it: "Hai effettuato troppe richieste. Riprova tra qualche minuto.",
    en: "You have made too many requests. Try again in a few minutes.",
    fr: "Vous avez effectué trop de requêtes. Réessayez dans quelques minutes.",
    de: "Du hast zu viele Anfragen gestellt. Versuche es in einigen Minuten erneut.",
    es: "Has realizado demasiadas solicitudes. Inténtalo de nuevo en unos minutos.",
    jp: "リクエストが多すぎます。数分後にもう一度お試しください。",
  },
};

// Lingue da completare (solo se vuote) su chiavi gia' presenti in produzione.
const FILL_EMPTY: Record<string, Partial<Translation>> = {
  str_vuoi_cancellare: {
    // it e' gia' presente: "Vuoi cancellare questo pagamento?"
    en: "Do you want to cancel this payment?",
    fr: "Voulez-vous annuler ce paiement ?",
    de: "Möchtest du diese Zahlung abbrechen?",
    es: "¿Quieres cancelar este pago?",
    jp: "この支払いをキャンセルしますか？",
  },
};

async function run() {
  const client = new MongoClient(connectionString!, {
    serverSelectionTimeoutMS: 10000,
  });
  await client.connect();
  const lngCol = client.db().collection("lng");
  const tplCol = client.db().collection("templateMail");
  const prefix = dryRun ? "[dry-run] " : "";

  let inserted = 0;
  let completed = 0;
  let skipped = 0;

  // --- 1) lng: inserisci le chiavi mancanti / completa le lingue vuote ---
  const allKeys: Record<string, Translation> = { ...SEED_KEYS, ...EXTRA_KEYS };
  for (const [txt, values] of Object.entries(allKeys)) {
    const existing = await lngCol.findOne({ txt });

    if (!existing) {
      const doc = { id: Guid.create().toString(), txt, ...values };
      console.log(`${prefix}+ lng ${txt}`);
      if (!dryRun) {
        await lngCol.insertOne(doc);
      }
      inserted++;
      continue;
    }

    // Solo le lingue vuote o assenti: mai toccare le traduzioni esistenti
    const set: Record<string, string> = {};
    for (const lang of LANGS) {
      if (!existing[lang] && values[lang]) {
        set[lang] = values[lang];
      }
    }
    if (Object.keys(set).length === 0) {
      skipped++;
      continue;
    }
    console.log(`${prefix}~ lng ${txt} (completa: ${Object.keys(set).join(", ")})`);
    if (!dryRun) {
      await lngCol.updateOne({ txt }, { $set: set });
    }
    completed++;
  }

  // --- 2) lng: lingue vuote su chiavi fuori dagli insiemi sopra ---
  for (const [txt, values] of Object.entries(FILL_EMPTY)) {
    const existing = await lngCol.findOne({ txt });
    if (!existing) {
      console.log(`${prefix}! lng ${txt} assente, skip`);
      continue;
    }
    const set: Record<string, string> = {};
    for (const [lang, value] of Object.entries(values)) {
      if (!existing[lang] && value) {
        set[lang] = value;
      }
    }
    if (Object.keys(set).length === 0) {
      skipped++;
      continue;
    }
    console.log(`${prefix}~ lng ${txt} (completa: ${Object.keys(set).join(", ")})`);
    if (!dryRun) {
      await lngCol.updateOne({ txt }, { $set: set });
    }
    completed++;
  }

  // --- 3) templateMail: migrazione RECOVER_PASSWORD ({password} -> {url}) ---
  let templatesUpdated = 0;
  let templatesSkipped = 0;
  for (const t of RECOVER_TEMPLATES) {
    for (const type of t.types) {
      const existing = await tplCol.findOne({ type });
      if (existing && existing.body && !existing.body.includes("{password}")) {
        console.log(`${prefix}- templateMail ${type}: gia' a posto, skip`);
        templatesSkipped++;
        continue;
      }
      console.log(`${prefix}~ templateMail ${type}: nuovo layout {url}`);
      if (!dryRun) {
        await tplCol.updateOne({ type }, { $set: { type, title: t.title, body: t.body } }, { upsert: true });
      }
      templatesUpdated++;
    }
  }

  console.log(
    `Riepilogo lng: inserite ${inserted}, completate ${completed}, invariative ${skipped}. ` +
      `templateMail: aggiornati ${templatesUpdated}, skip ${templatesSkipped}.`
  );
  await client.close();
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
