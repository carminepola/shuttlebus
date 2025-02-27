import { Guid } from "guid-typescript";

export default class LngModel {
  public id?: string;

  public txt: string;
  public name?: {
    it?: string;
    en?: string;
  };

  constructor(lng?: any) {
    debugger;
    this.txt = lng?.txt || "";
    this.id = lng?.id || Guid.create().toString();
    if (!this.name) {
      this.name = { it: "", en: "" };
    }
    this.name.it = lng?.name?.it || "";
    this.name.en = lng?.name?.en || "";
  }
}
