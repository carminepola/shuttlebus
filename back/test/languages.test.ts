import { pickLanguageStrings, validateLanguageSettings } from "../src/i18n/languages";
import { Translator, fillVariables, invalidateTranslations } from "../src/i18n/translate";
import LngModel from "../src/model/lngModel";

const base = {
  defaultLanguage: "it",
  languages: [
    { code: "it", name: "Italiano", flag: "🇮🇹", locale: "it", enabled: true },
    { code: "pt", name: "Português", flag: "", locale: "", enabled: false },
  ],
};

/** DB finto: lingue configurate + righe lng. */
function fakeDb(rows: any[], settings: any = base) {
  return {
    collection: (name: string) => ({
      findOne: async () => (name === "languageSettings" ? { id: "default", ...settings } : null),
      find: () => ({ toArray: async () => (name === "lng" ? rows : []) }),
    }),
  } as any;
}

describe("lingue configurabili", () => {
  it("valida codici, nomi, lingua predefinita attiva", () => {
    const ok = validateLanguageSettings(base);
    expect(ok.settings?.languages[1].locale).toBe("pt"); // locale vuoto = codice
    expect(validateLanguageSettings({ ...base, defaultLanguage: "pt" }).error).toMatch(/predefinita/);
    expect(validateLanguageSettings({ defaultLanguage: "it", languages: [{ code: "IT!", name: "x" }] }).error).toMatch(/Codice/);
    expect(validateLanguageSettings({ defaultLanguage: "id", languages: [{ code: "id", name: "x" }] }).error).toMatch(/Codice/);
    expect(validateLanguageSettings({ defaultLanguage: "it", languages: [base.languages[0], base.languages[0]] }).error).toMatch(/ripetuta/);
  });

  it("pickLanguageStrings tiene solo i testi per lingua", () => {
    expect(pickLanguageStrings({ id: "1", txt: "k", it: "Ciao", "pt-br": "Olá", _id: "x", en: 3 })).toEqual({ it: "Ciao", "pt-br": "Olá" });
  });

  it("LngModel accetta lingue nuove", () => {
    const m = new LngModel({ txt: "str_x", it: "Ciao", pt: "Olá", hack: { $set: 1 } });
    expect(m.toDocument()).toMatchObject({ txt: "str_x", it: "Ciao", pt: "Olá" });
    expect((m.toDocument() as any).hack).toBeUndefined();
  });
});

describe("traduttore lato server", () => {
  beforeEach(() => invalidateTranslations());

  it("ripiega sulla lingua predefinita e poi sui testi di default", async () => {
    const db = fakeDb([{ txt: "mail_greeting", it: "Ciao {name},", pt: "" }]);
    const t = await Translator.for(db, "pt");
    expect(t.t("mail_greeting", { name: "Ana" })).toBe("Ciao Ana,"); // pt vuoto -> it
    expect(t.t("chiave_inesistente")).toBe("chiave_inesistente");
  });

  it("fillVariables lascia intatte le variabili sconosciute", () => {
    expect(fillVariables("{a} {b}", { a: "1" })).toBe("1 {b}");
  });
});
