import { Guid } from "guid-typescript";
import { sanitizeDaysOfWeek } from "../utils/ticketDays";
import { pickLanguageStrings } from "../i18n/languages";

export default class ticketTypeModel {
  public id?: string;
  public createdAt?: number;
  public updatedAt?: number;
  // testi per codice lingua configurato: { it: "Adulto", en: "Adult", ... }
  public name?: Record<string, string>;
  public description?: Record<string, string>;
  public cost: number;
  // Giorni di validita' (1 = lun ... 7 = dom); vuoto = tutti i giorni
  public daysOfWeek: number[];
  // Mostrato nella ricerca della home; gli altri si aggiungono solo sulla corsa dopo la ricerca
  public showOnHome: boolean;
  public isActive: boolean;
  public isDeleted: boolean;
  constructor(ticketType?: any) {
    this.id = ticketType?.id || Guid.create().toString();
    this.name = pickLanguageStrings(ticketType?.name, 200);
    this.description = pickLanguageStrings(ticketType?.description, 2000);
    this.cost = ticketType?.cost || 0;
    this.daysOfWeek = sanitizeDaysOfWeek(ticketType?.daysOfWeek);

    this.showOnHome = ticketType?.showOnHome === false ? false : true;
    this.isActive = ticketType?.isActive == false ? false : true;
    this.isDeleted = ticketType?.isDeleted == true ? true : false;
    if (!ticketType?.id) {
      this.createdAt = new Date().getTime();
    } else if (ticketType?.createdAt) {
      this.createdAt = ticketType.createdAt;
    }
    this.updatedAt = new Date().getTime();
  }
}
