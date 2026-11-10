import { MAIL_TYPES, MailBlock } from "../src/mail/mailTypes";
import { renderMail, formatAmount } from "../src/mail/renderMail";
import { invalidateTranslations } from "../src/i18n/translate";
import lngData from "../src/data/lng.json";

const LNG = lngData as Record<string, Record<string, string>>;
const LANGS = ["it", "en", "fr", "de", "es", "jp"];

/** DB finto: nessuna configurazione e nessuna traduzione salvata (valgono i default). */
const emptyDb = {
  collection: () => ({ findOne: async () => null, find: () => ({ toArray: async () => [] }) }),
} as any;

function keysOf(blocks: MailBlock[]): string[] {
  const keys: string[] = [];
  for (const b of blocks) {
    if ("key" in b) keys.push(b.key);
    if (b.type === "greeting") keys.push("mail_greeting");
    if (b.type === "code") keys.push(...[b.labelKey, b.hintKey].filter((k): k is string => !!k));
    if (b.type === "button" && b.fallback) keys.push("mail_button_fallback");
    if (b.type === "details") keys.push(...b.rows.map((r) => r.labelKey));
    if (b.type === "list") keys.push(...(b.titleKey ? [b.titleKey] : []), ...b.keys);
    if (b.type === "qr" && b.captionKey) keys.push(b.captionKey);
  }
  return keys;
}

describe("mail standard", () => {
  beforeEach(() => {
    invalidateTranslations();
    process.env.COMPANY_NAME = "Acme Bus";
    process.env.CLIENT_URL = "https://acme.example";
    process.env.BRAND_PRIMARY_COLOR = "#123abc";
  });

  it("ogni chiave usata dai tipi esiste in tutte le lingue di base", () => {
    for (const [type, def] of Object.entries(MAIL_TYPES)) {
      const keys = [def.subjectKey, ...keysOf(def.blocks as MailBlock[])].filter((k) => !k.startsWith("{"));
      for (const key of keys) {
        for (const l of LANGS) {
          expect([type, key, l, LNG[key]?.[l] ? "ok" : "mancante"]).toEqual([type, key, l, "ok"]);
        }
      }
    }
  });

  it("rende ogni tipo in ogni lingua con le variabili d'esempio", async () => {
    for (const type of Object.keys(MAIL_TYPES) as (keyof typeof MAIL_TYPES)[]) {
      for (const l of LANGS) {
        const { subject, html } = await renderMail(emptyDb, type, l, MAIL_TYPES[type].sample);
        expect(subject.length).toBeGreaterThan(0);
        expect(html).toContain("#123abc");
        expect(html).not.toMatch(/\{(name|pin|order_id|company|url|code|title)\}/); // nessuna variabile rimasta
        expect(html).not.toMatch(/mail_[a-z_]+/); // nessuna chiave non tradotta
      }
    }
  });

  it("escapa le variabili e mette il link nel pulsante", async () => {
    const { html, subject } = await renderMail(emptyDb, "RECOVER_PASSWORD", "it", { name: "<script>x</script>", mail: "a@b.it", url: "https://acme.example/reset?t=1&x=2" });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('href="https://acme.example/reset?t=1&amp;x=2"');
    expect(subject).toBe("Reimposta la tua password");
  });

  it("lingua non tradotta: testi nella lingua predefinita", async () => {
    const { subject } = await renderMail(emptyDb, "WELCOME", "pt", { name: "Ana", pin: "1" });
    expect(subject).toBe("Benvenuto in Acme Bus");
  });

  it("importi nella valuta e nel formato della lingua", () => {
    expect(formatAmount("25.5", "it").replace(/\s/g, " ")).toBe("25,50 €");
    expect(formatAmount("25.5", "en")).toBe("€25.50");
    expect(formatAmount("n/d", "it")).toBe("n/d");
  });
});
