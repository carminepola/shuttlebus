/**
 * Dati aziendali e colori del brand, dal .env. Traduzioni (collection lng) e
 * template mail (collection templateMail) non contengono il nome dell'azienda
 * ma dei segnaposto, sostituiti qui:
 *
 *   traduzioni:   {{company}}  {{companyLegalName}}
 *   template:     {company}  {companyLegalName}  {companyFooter}  {primaryColor}  {siteUrl}
 *
 * Variabili d'ambiente:
 *   COMPANY_NAME          nome commerciale (default: APP_NAME)
 *   COMPANY_LEGAL_NAME    ragione sociale (default: COMPANY_NAME)
 *   COMPANY_INFO          righe del piè di pagina delle mail, separate da "|"
 *                         (es. "Sede legale: Via Roma 1, Napoli|Partita IVA 01234567890")
 *   COMPANY_INFO_EN       come sopra per le mail non in italiano (default: COMPANY_INFO);
 *                         COMPANY_INFO_FR, _DE, _ES, _JP per la singola lingua
 *   COMPANY_PHONE         telefono mostrato (link tel:) nel piè di pagina
 *   COMPANY_EMAIL         email mostrata (link mailto:) nel piè di pagina
 *   BRAND_PRIMARY_COLOR   colore di link, pulsanti e codici nelle mail (es. "#1e3a5f")
 */

const DEFAULT_COLOR = "#1e3a5f";

export interface CompanyInfo {
  name: string;
  legalName: string;
  primaryColor: string;
  phone: string;
  email: string;
  siteUrl: string;
}

const clean = (v: string | undefined) => (typeof v === "string" ? v.trim() : "");

export function companyInfo(): CompanyInfo {
  const name = clean(process.env.COMPANY_NAME) || clean(process.env.APP_NAME) || "Shuttlebus";
  const color = clean(process.env.BRAND_PRIMARY_COLOR);
  return {
    name,
    legalName: clean(process.env.COMPANY_LEGAL_NAME) || name,
    // solo colori esadecimali: il valore finisce in attributi style
    primaryColor: /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color) ? color : DEFAULT_COLOR,
    phone: clean(process.env.COMPANY_PHONE),
    email: clean(process.env.COMPANY_EMAIL),
    siteUrl: clean(process.env.CLIENT_URL),
  };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Righe aziendali per la lingua: COMPANY_INFO_<LNG>, poi COMPANY_INFO_EN (non italiano), poi COMPANY_INFO. */
function infoLines(lng: string): string[] {
  const l = (lng || "it").toUpperCase();
  const raw =
    clean(process.env[`COMPANY_INFO_${l}`]) || (l !== "IT" ? clean(process.env.COMPANY_INFO_EN) : "") || clean(process.env.COMPANY_INFO);
  return raw
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Piè di pagina HTML delle mail: ragione sociale, righe aziendali, telefono ed email. */
export function companyFooterHtml(lng: string = "it"): string {
  const c = companyInfo();
  const lines = [escapeHtml(c.legalName), ...infoLines(lng).map(escapeHtml)];
  const link = (href: string, text: string) => `<a href="${escapeHtml(href)}" style="color: ${c.primaryColor}; text-decoration: none;">${escapeHtml(text)}</a>`;
  if (c.phone) lines.push(link("tel:" + c.phone.replace(/[^+\d]/g, ""), c.phone));
  if (c.email) lines.push(link("mailto:" + c.email, c.email));
  return lines.join("<br>");
}

/** Variabili aziendali comuni a tutti i template mail. */
export function companyMailVariables(lng: string = "it"): Record<string, string> {
  const c = companyInfo();
  return {
    company: escapeHtml(c.name),
    companyLegalName: escapeHtml(c.legalName),
    companyFooter: companyFooterHtml(lng),
    primaryColor: c.primaryColor,
    siteUrl: escapeHtml(c.siteUrl),
  };
}

/** Lingua dal tipo di template: "WELCOME_EN" -> "en", "WELCOME" -> "it". */
export function lngFromMailType(type: string | undefined): string {
  const m = /_(EN|FR|DE|ES|JP)$/.exec(type || "");
  return m ? m[1].toLowerCase() : "it";
}

/** Sostituisce {{company}} e {{companyLegalName}} nei testi delle traduzioni. */
export function applyCompanyToText(text: string): string {
  if (typeof text !== "string" || !text.includes("{{")) return text;
  const c = companyInfo();
  return text.replace(/\{\{companyLegalName\}\}/g, c.legalName).replace(/\{\{company\}\}/g, c.name);
}
