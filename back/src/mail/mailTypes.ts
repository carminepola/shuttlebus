/**
 * Tipi di mail: solo la struttura. I testi sono chiavi di traduzione (collection lng,
 * default in src/data/lng.json) e il layout e' unico (mail/renderMail.ts), quindi per
 * cambiare una frase basta Impostazioni -> Traduzioni e per una mail nuova basta
 * aggiungere qui un tipo e le sue chiavi.
 *
 * Nei testi {variabile} viene sostituita con i valori passati alla mail (escapati),
 * {company} col nome dell'azienda.
 */

export type MailBlock =
  /** Titolo grande. */
  | { type: "heading"; key: string }
  /** "Ciao {name}," */
  | { type: "greeting" }
  /** Paragrafo. */
  | { type: "text"; key: string; small?: boolean }
  /** Codice in evidenza (PIN, codice di verifica), con etichetta e nota facoltative. */
  | { type: "code"; variable: string; labelKey?: string; hintKey?: string }
  /** Pulsante con link; `fallback` aggiunge il link in chiaro sotto. */
  | { type: "button"; key: string; urlVariable: string; fallback?: boolean }
  /** Tabella etichetta: valore (le righe con valore vuoto non compaiono). */
  | { type: "details"; rows: { labelKey: string; variable: string; format?: "amount" | "payment" }[] }
  /** Elenco puntato, con titolo facoltativo. */
  | { type: "list"; titleKey?: string; keys: string[] }
  /** HTML generato dal codice (gia' escapato), es. il riepilogo del biglietto. */
  | { type: "html"; variable: string }
  /** Immagine QR del codice nella variabile. */
  | { type: "qr"; variable: string; captionKey?: string };

export interface MailTypeDefinition {
  subjectKey: string;
  blocks: MailBlock[];
  /** Variabili di esempio per la mail di prova (Impostazioni -> Test email). */
  sample: Record<string, string>;
}

export const MAIL_TYPES = {
  WELCOME: {
    subjectKey: "mail_welcome_subject",
    blocks: [
      { type: "heading", key: "mail_welcome_heading" },
      { type: "greeting" },
      { type: "text", key: "mail_welcome_intro" },
      { type: "code", variable: "pin", labelKey: "mail_welcome_code_label" },
      { type: "text", key: "mail_welcome_code_hint" },
      { type: "list", titleKey: "mail_welcome_features_title", keys: ["mail_welcome_feature_1", "mail_welcome_feature_2", "mail_welcome_feature_3", "mail_welcome_feature_4"] },
      { type: "text", key: "mail_welcome_support" },
      { type: "text", key: "mail_welcome_ignore", small: true },
    ],
    sample: { name: "Mario Rossi", pin: "123456" },
  },
  RECOVER_PASSWORD: {
    subjectKey: "mail_recover_subject",
    blocks: [
      { type: "heading", key: "mail_recover_subject" },
      { type: "greeting" },
      { type: "text", key: "mail_recover_intro" },
      { type: "button", key: "mail_recover_button", urlVariable: "url", fallback: true },
      { type: "text", key: "mail_recover_validity" },
      { type: "text", key: "mail_recover_ignore", small: true },
    ],
    sample: { name: "Mario Rossi", mail: "mario.rossi@example.com", url: "{siteUrl}/reset-password?token=TEST" },
  },
  PURCHASE_COMPLETED: {
    subjectKey: "mail_purchase_completed_subject",
    blocks: [
      { type: "heading", key: "mail_purchase_completed_heading" },
      { type: "greeting" },
      { type: "text", key: "mail_purchase_completed_intro" },
      {
        type: "details",
        rows: [
          { labelKey: "mail_label_order_id", variable: "order_id" },
          { labelKey: "mail_label_amount", variable: "amount", format: "amount" },
          { labelKey: "mail_label_payment_method", variable: "payment_method", format: "payment" },
        ],
      },
      { type: "html", variable: "route" },
      { type: "qr", variable: "order_id", captionKey: "mail_purchase_completed_qr" },
      { type: "text", key: "mail_purchase_completed_tickets" },
      { type: "button", key: "mail_purchase_completed_button", urlVariable: "mytickets_url" },
      { type: "text", key: "mail_purchase_completed_thanks" },
    ],
    sample: { name: "Mario Rossi", order_id: "TEST-ORDER-0001", amount: "99", payment_method: "stripe", mytickets_url: "{siteUrl}/user/mytickets" },
  },
  /** Biglietto annullato: quale viaggio, che non e' piu' valido e a chi rivolgersi. */
  PURCHASE_CANCELLED: {
    subjectKey: "mail_ticket_cancelled_subject",
    blocks: [
      { type: "heading", key: "mail_ticket_cancelled_heading" },
      { type: "greeting" },
      { type: "text", key: "mail_ticket_cancelled_intro" },
      { type: "html", variable: "route" },
      { type: "text", key: "mail_ticket_cancelled_invalid" },
      { type: "text", key: "mail_ticket_cancelled_support" },
      { type: "text", key: "mail_thanks_short" },
    ],
    sample: { name: "Mario Rossi", order_id: "TEST-ORDER-0001", travel_date: "venerdì 20 novembre 2026" },
  },
  REFUND_PROCESSED: {
    subjectKey: "mail_refund_subject",
    blocks: [
      { type: "heading", key: "mail_refund_heading" },
      { type: "greeting" },
      { type: "text", key: "mail_refund_intro" },
      {
        type: "details",
        rows: [
          { labelKey: "mail_label_refund_amount", variable: "amount", format: "amount" },
          { labelKey: "mail_label_order_id", variable: "order_id" },
        ],
      },
      { type: "text", key: "mail_refund_credit" },
      { type: "text", key: "mail_refund_questions" },
    ],
    sample: { name: "Mario Rossi", order_id: "TEST-ORDER-0001", amount: "25.5" },
  },
  MFA_CODE: {
    subjectKey: "mail_mfa_subject",
    blocks: [
      { type: "heading", key: "mail_mfa_subject" },
      { type: "text", key: "mail_mfa_intro" },
      { type: "code", variable: "code" },
      { type: "text", key: "mail_mfa_hint", small: true },
    ],
    sample: { code: "123456" },
  },
  ACCOUNT_DELETED: {
    subjectKey: "mail_account_deleted_subject",
    blocks: [
      { type: "heading", key: "mail_account_deleted_subject" },
      { type: "text", key: "mail_account_deleted_text" },
    ],
    sample: {},
  },
  /** Mail libera (notifiche admin): titolo e corpo HTML generati dal codice. */
  GENERIC: {
    subjectKey: "{title}",
    blocks: [{ type: "html", variable: "body" }],
    sample: { title: "Email di test", body: "<p>Questo è il corpo di prova dell'email di test.</p>" },
  },
} satisfies Record<string, MailTypeDefinition>;

export type MailType = keyof typeof MAIL_TYPES;

export function isMailType(type: any): type is MailType {
  return typeof type === "string" && Object.prototype.hasOwnProperty.call(MAIL_TYPES, type);
}

/** Variabili che contengono HTML gia' pronto (generato dal codice): non vengono escapate. */
export const HTML_VARIABLES = new Set(["route", "body"]);
