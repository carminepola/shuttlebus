/**
 * Toglie dai testi delle traduzioni i dati di una specifica azienda, per riusare il
 * progetto (o un ambiente di test) con un'altra:
 * - nome e ragione sociale -> {{company}} / {{companyLegalName}} (dal .env);
 * - indirizzo della sede, telefoni, email, call center -> rimossi;
 * - siti esterni dell'azienda -> "questo sito";
 * - email di contatto (privacy) -> {{companyEmail}} (COMPANY_EMAIL nel .env).
 * Usata per src/data/lng.json e dallo script neutralize-company-lng sul DB.
 */

/** Nomi dell'azienda da sostituire (case-insensitive). */
const COMPANY_NAMES = ["Pintour"];
/** Domini dell'azienda: i link vengono tolti, mai trasformati in segnaposto. */
const COMPANY_SITE = /https?:\/\/www\.(?:\{\{company\}\}|pintour)bus\.com|https?:\/\/www\.amalfiairportlink\.com/i;

const THIS_SITE: Record<string, string> = {
  it: "questo sito",
  en: "this website",
  fr: "ce site",
  de: "diese Website",
  es: "este sitio web",
  jp: "本ウェブサイト",
};

const SITE_LINK = String.raw`<a href="(?:https?:\/\/www\.(?:\{\{company\}\}|pintour)bus\.com|https?:\/\/www\.amalfiairportlink\.com)"[^>]*>[^<]*<\/a>`;
const TEL_LINK = String.raw`<a href="tel:[^"]*">[^<]*<\/a>`;
const ADDRESS_INTRO = String.raw`(?:con sede legale in|with its registered office in|dont le siège social est situé à|mit Sitz in|con domicilio social en)`;

export function neutralizeCompanyText(text: string, lng: string): string {
  if (typeof text !== "string" || !text) return text;
  let s = text;

  // indirizzo della sede (it/en/fr/de/es) e versione giapponese tra parentesi
  s = s.replace(new RegExp(String.raw`\s*,?\s*${ADDRESS_INTRO}\s+Pimonte[^.]*?80050,?`, "g"), "");
  s = s.replace(/（本社：ピモンテ、[^）]*）/g, "");
  // riga "Tel: ... – Cell: ..." e riga "Email: ..."
  s = s.replace(new RegExp(String.raw`\s*<br>[^<]*${TEL_LINK}[^<]*${TEL_LINK}`, "g"), "");
  s = s.replace(/\s*<br>\s*Email:\s*<a href="mailto:[^"]*">[^<]*<\/a>/g, "");
  // frase "le condizioni sono consultabili sui siti: A / B."
  s = s.replace(new RegExp(String.raw`(?:<br>)?[^<>.。]*[:：]\s*${SITE_LINK}\s*\/\s*${SITE_LINK}\.?`, "g"), "");
  // voci di elenco "Call center: tel / tel"
  s = s.replace(new RegExp(String.raw`\s*<li>[^<]*${TEL_LINK}[^<]*${TEL_LINK}[^<]*<\/li>`, "g"), "");
  // voci di elenco "Sito web / Online: siti" -> "questo sito"
  s = s.replace(new RegExp(String.raw`(<li>[^<:：]*[:：]\s*)${SITE_LINK}(?:,\s*${SITE_LINK})*(<\/li>)`, "g"), `$1${THIS_SITE[lng] || THIS_SITE.en}$2`);
  // email di contatto rimaste (es. privacy)
  s = s.replace(/<a href="mailto:[^"]*">[^<]*<\/a>/g, "{{companyEmail}}");

  // nome e ragione sociale (mai dentro domini: quelli sono gia' stati tolti)
  for (const name of COMPANY_NAMES) {
    s = s.replace(new RegExp(String.raw`\b${name}\s+S\.?\s?C\.?\s?A\.?\s?R\.?\s?L\.?`, "gi"), "{{companyLegalName}}");
    s = s.replace(new RegExp(String.raw`\b${name}\b(?!bus)`, "gi"), "{{company}}");
  }
  return s;
}

/** true se il testo contiene ancora dati dell'azienda. */
export function hasCompanyData(text: string): boolean {
  if (typeof text !== "string") return false;
  return COMPANY_SITE.test(text) || /tel:\+|Pimonte|ピモンテ|Castellammare|\{\{company\}\}bus|mailto:/i.test(text) || COMPANY_NAMES.some((n) => new RegExp(String.raw`\b${n}\b`, "i").test(text));
}
