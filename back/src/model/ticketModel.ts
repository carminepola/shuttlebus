import { Guid } from "guid-typescript";

export default class StopModel {
  public id?: string;
  public createdAt?: number;
  public updatedAt?: number;
  public name?: {
    it?: string;
    en?: string;
  };
  public description?: {
    it?: string;
    en?: string;
  };
  public cost: number;

  constructor(ticket?: any) {
    debugger;
    this.id = ticket?.id || Guid.create().toString();
    if (!this.name) {
      this.name = { it: "", en: "" };
    }
    this.name.it = ticket?.name?.it || "";
    this.name.en = ticket?.name?.en || "";
    this.description = ticket?.description || { it: "", en: "" };
    this.cost = ticket?.cost || 0;

    if (!ticket?.id) {
      this.createdAt = new Date().getTime();
    } else if (ticket?.createdAt) {
      this.createdAt = ticket.createdAt;
    }
    this.updatedAt = new Date().getTime();
  }
}
