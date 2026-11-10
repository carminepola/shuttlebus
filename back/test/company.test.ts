import { applyCompanyToText, companyFooterHtml, companyInfo } from "../src/utils/company";
import { seedDefaultData } from "../src/components/services/defaultDataServices";
import lngData from "../src/data/lng.json";

const ENV_KEYS = ["COMPANY_NAME", "COMPANY_LEGAL_NAME", "COMPANY_INFO", "COMPANY_INFO_EN", "COMPANY_PHONE", "COMPANY_EMAIL", "BRAND_PRIMARY_COLOR", "APP_NAME"];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  Object.assign(process.env, {
    COMPANY_NAME: "Acme Bus",
    COMPANY_LEGAL_NAME: "Acme Bus S.r.l.",
    COMPANY_INFO: "Sede legale: Via Roma 1|P.IVA 123",
    COMPANY_INFO_EN: "Registered office: Via Roma 1|VAT 123",
    COMPANY_PHONE: "+39 081 1234567",
    BRAND_PRIMARY_COLOR: "#123abc",
  });
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("dati aziendali", () => {
  it("sostituisce i segnaposto delle traduzioni", () => {
    expect(applyCompanyToText("{{company}} di {{companyLegalName}}")).toBe("Acme Bus di Acme Bus S.r.l.");
    expect(applyCompanyToText("nessun segnaposto")).toBe("nessun segnaposto");
  });

  it("piè di pagina per lingua, con telefono e testo escapato", () => {
    expect(companyFooterHtml("it")).toContain("Sede legale: Via Roma 1<br>P.IVA 123");
    expect(companyFooterHtml("de")).toContain("Registered office: Via Roma 1");
    expect(companyFooterHtml("it")).toContain('href="tel:+390811234567"');
    process.env.COMPANY_LEGAL_NAME = "<b>x</b>";
    expect(companyFooterHtml("it")).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("colore solo esadecimale, altrimenti default", () => {
    expect(companyInfo().primaryColor).toBe("#123abc");
    process.env.BRAND_PRIMARY_COLOR = "red;background:url(x)";
    expect(companyInfo().primaryColor).toBe("#1e3a5f");
  });

});

describe("dati di base versionati", () => {
  it("nessun dato aziendale scritto nei file", () => {
    expect(/pintour/i.test(JSON.stringify(lngData))).toBe(false);
  });

  /** Collection finta in memoria (solo i metodi usati dal seed). */
  function fakeDb(initial: Record<string, any[]>) {
    const data: Record<string, any[]> = JSON.parse(JSON.stringify(initial));
    const match = (doc: any, q: any) => Object.entries(q).every(([k, v]) => doc[k] === v);
    return {
      data,
      collection: (name: string) => {
        data[name] ||= [];
        return {
          find: () => ({ toArray: async () => data[name].map((d) => ({ ...d })) }),
          insertOne: async (doc: any) => void data[name].push({ ...doc }),
          updateOne: async (q: any, u: any) => Object.assign(data[name].find((d) => match(d, q)), u.$set),
        };
      },
    } as any;
  }

  it("DB nuovo: inserisce tutte le traduzioni", async () => {
    const db = fakeDb({});
    const res = await seedDefaultData(db);
    expect(res.lng.inserted).toBe(Object.keys(lngData).length);
    expect(db.data.lng.every((r: any) => r.id && r.txt)).toBe(true);
  });

  it("DB esistente: non tocca i testi modificati, completa solo le lingue mai inserite", async () => {
    const [key] = Object.keys(lngData);
    const db = fakeDb({ lng: [{ txt: key, it: "Modificato", en: "" }] });
    await seedDefaultData(db);
    const row = db.data.lng.find((r: any) => r.txt === key);
    expect(row.it).toBe("Modificato");
    expect(row.en).toBe(""); // vuota per scelta: resta
    expect(row.fr).toBe((lngData as any)[key].fr);

    await seedDefaultData(db, { overwriteLng: true });
    expect(db.data.lng.find((r: any) => r.txt === key).it).toBe((lngData as any)[key].it);
  });
});

import { neutralizeCompanyText, hasCompanyData } from "../src/i18n/neutralizeCompany";

describe("rimozione dati aziendali dai testi", () => {
  it("nome -> segnaposto senza toccare i domini, contatti rimossi", () => {
    const it =
      'servizio di <strong>Pintour Scarl</strong>, con sede legale in Pimonte alla Via Castellammare 18 - 80050. <br>Tel: <a href="tel:+39081">081</a> – Cell: <a href="tel:+39335">335</a> <br>Email: <a href="mailto:ordini@pintourbus.com">ordini@pintourbus.com</a> ' +
      '<ul><li>Online: <a href="https://www.amalfiairportlink.com" target="_blank">a</a>, <a href="https://www.pintourbus.com" target="_blank">b</a></li><li>Call center: <a href="tel:+1">1</a> / <a href="tel:+2">2</a></li></ul> pintour non risponde';
    const out = neutralizeCompanyText(it, "it");
    expect(out).toBe("servizio di <strong>{{companyLegalName}}</strong>. <ul><li>Online: questo sito</li></ul> {{company}} non risponde");
    expect(hasCompanyData(out)).toBe(false);
  });

  it("email di contatto -> {{companyEmail}}", () => {
    expect(neutralizeCompanyText('scrivi a: <a href="mailto:x@y.it">x@y.it</a>.', "en")).toBe("scrivi a: {{companyEmail}}.");
  });
});
