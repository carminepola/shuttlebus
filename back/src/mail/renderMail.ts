import { Db } from "mongodb";
import { companyFooterHtml, companyInfo, escapeHtml } from "../utils/company";
import { Translator, fillVariables } from "../i18n/translate";
import { getLanguageSettings } from "../i18n/languages";
import { HTML_VARIABLES, MAIL_TYPES, MailBlock, MailType } from "./mailTypes";

/**
 * Layout unico delle mail: logo, contenuto a blocchi, piè di pagina aziendale,
 * colore del brand (BRAND_PRIMARY_COLOR). HTML a tabelle e stili in linea, come
 * richiedono i client di posta.
 */

/** Logo del brand servito dal front (front/brands/<brand>/assets/logo.png). */
export const BRAND_LOGO_PATH = "/assets/brand/logo.png";

/** Generatore dell'immagine QR: {data} e' il contenuto (QR_CODE_URL nel .env per cambiarlo). */
const DEFAULT_QR_URL = "https://api.qrserver.com/v1/create-qr-code/?size=180x180&data={data}";

export interface RenderedMail {
  subject: string;
  html: string;
}

const FONT = "Arial, Helvetica, sans-serif";

/** Importo nella valuta del .env (CURRENCY, default EUR) e nel formato della lingua. */
export function formatAmount(value: string, locale: string): string {
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return value;
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: process.env.CURRENCY || "EUR" }).format(n);
  } catch {
    return `${n.toFixed(2)} ${process.env.CURRENCY || "EUR"}`;
  }
}

export async function renderMail(db: Db, type: MailType, lng: string | undefined, variables: Record<string, string> = {}): Promise<RenderedMail> {
  const def = MAIL_TYPES[type];
  const t = await Translator.for(db, lng);
  const settings = await getLanguageSettings(db);
  const locale = settings.languages.find((l) => l.code === t.lng)?.locale || t.lng;
  const company = companyInfo();
  const color = company.primaryColor;

  // valori sicuri per l'HTML: escapati, tranne l'HTML generato dal codice
  const safe: Record<string, string> = { company: escapeHtml(company.name), siteUrl: escapeHtml(company.siteUrl) };
  for (const [k, v] of Object.entries(variables)) {
    const value = String(v ?? "").replace(/\{siteUrl\}/g, company.siteUrl);
    safe[k] = HTML_VARIABLES.has(k) ? value : escapeHtml(value);
  }

  /** Testo della chiave; una chiave assente che contiene {variabili} vale come testo (es. "{title}"). */
  const tx = (key: string) => {
    const text = t.t(key, safe);
    return text === key && key.includes("{") ? fillVariables(key, safe) : text;
  };

  const p = (html: string, style = "") => `<p style="margin:0 0 16px;line-height:1.55;${style}">${html}</p>`;

  const block = (b: MailBlock): string => {
    switch (b.type) {
      case "heading":
        return `<h2 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#222222;">${tx(b.key)}</h2>`;
      case "greeting":
        return safe.name ? p(tx("mail_greeting")) : "";
      case "text":
        return p(tx(b.key), b.small ? "font-size:13px;color:#666666;" : "");
      case "code": {
        const code = safe[b.variable];
        if (!code) return "";
        return `<div style="background:#f6f7f9;border:1px solid #e3e5e8;border-radius:8px;padding:16px;margin:0 0 16px;text-align:center;">
${b.labelKey ? `<p style="margin:0 0 8px;font-weight:bold;">${tx(b.labelKey)}</p>` : ""}<p style="margin:0;font-size:28px;font-weight:bold;letter-spacing:5px;color:${color};">${code}</p>
${b.hintKey ? `<p style="margin:8px 0 0;font-size:13px;color:#666666;">${tx(b.hintKey)}</p>` : ""}</div>`;
      }
      case "button": {
        const url = safe[b.urlVariable];
        if (!url) return "";
        const button = `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;"><tr><td style="border-radius:6px;background:${color};">
<a href="${url}" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:6px;">${tx(b.key)}</a></td></tr></table>`;
        const fallback = b.fallback
          ? p(`${tx("mail_button_fallback")} <a href="${url}" style="color:${color};word-break:break-all;">${url}</a>`, "font-size:12px;color:#666666;")
          : "";
        return button + fallback;
      }
      case "details": {
        const rows = b.rows
          .filter((r) => safe[r.variable])
          .map((r) => {
            let value = safe[r.variable];
            if (r.format === "amount") value = escapeHtml(formatAmount(variables[r.variable], locale));
            // metodo di pagamento: stripe / cash / free -> mail_payment_<metodo>, se tradotto
            if (r.format === "payment") {
              const key = `mail_payment_${String(variables[r.variable]).toLowerCase()}`;
              const label = t.t(key);
              if (label !== key) value = label;
            }
            return `<tr><td style="padding:6px 12px 6px 0;color:#666666;white-space:nowrap;vertical-align:top;">${tx(r.labelKey)}</td><td style="padding:6px 0;font-weight:bold;">${value}</td></tr>`;
          })
          .join("");
        return rows ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border-collapse:collapse;">${rows}</table>` : "";
      }
      case "list":
        return `${b.titleKey ? p(`<strong>${tx(b.titleKey)}</strong>`, "margin-bottom:8px;") : ""}<ul style="margin:0 0 16px;padding-left:20px;line-height:1.7;">${b.keys
          .map((k) => `<li>${tx(k)}</li>`)
          .join("")}</ul>`;
      case "html":
        return safe[b.variable] ? `<div style="margin:0 0 16px;line-height:1.55;">${safe[b.variable]}</div>` : "";
      case "qr": {
        const data = variables[b.variable];
        if (!data) return "";
        const src = (process.env.QR_CODE_URL || DEFAULT_QR_URL).replace("{data}", encodeURIComponent(data));
        return `<div style="text-align:center;margin:8px 0 16px;"><img src="${escapeHtml(src)}" alt="QR" width="180" height="180" style="display:inline-block;" />
${b.captionKey ? `<p style="margin:8px 0 0;font-size:13px;color:#666666;">${tx(b.captionKey)}</p>` : ""}</div>`;
      }
    }
  };

  const subject = tx(def.subjectKey)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const logo = company.siteUrl ? `<img src="${escapeHtml(company.siteUrl + BRAND_LOGO_PATH)}" alt="${safe.company}" style="height:50px;" />` : `<strong style="font-size:22px;">${safe.company}</strong>`;

  const html = `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:${FONT};color:#333333;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f4;"><tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;border-top:4px solid ${color};">
<tr><td style="padding:20px;text-align:center;">${logo}</td></tr>
<tr><td style="padding:8px 28px 12px;font-size:15px;">${def.blocks.map(block).join("\n")}</td></tr>
<tr><td style="padding:16px 20px;text-align:center;font-size:12px;line-height:1.6;color:#666666;background:#fafafa;border-top:1px solid #dddddd;">${companyFooterHtml(t.lng)}</td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, html };
}
