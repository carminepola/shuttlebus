import { Guid } from "guid-typescript";
import { pickLanguageStrings } from "../i18n/languages";

/**
 * Riga di traduzione: `txt` e' la chiave, poi un campo per ogni codice lingua
 * configurato ({ txt: "str_ciao", it: "Ciao", en: "Hello", pt: "Olá" }).
 */
export default class LngModel {
  public id?: string;
  public txt: string;
  public values: Record<string, string>;

  constructor(lng?: any) {
    this.txt = typeof lng?.txt === "string" ? lng.txt : "";
    this.id = lng?.id || Guid.create().toString();
    this.values = pickLanguageStrings(lng);
  }

  /** Documento da salvare: { id, txt, it, en, ... }. */
  toDocument() {
    return { id: this.id, txt: this.txt, ...this.values };
  }
}
