import { Guid } from 'guid-typescript';

export default class ticketTypeModel {
  public id?: string;

  public createdAt?: number;

  public updatedAt?: number;

  public name?: {
    it?: string;
    en?: string;
    fr?: string;
    de?: string;
    es?: string;
    jp?: string;
  };

  public description?: {
    it?: string;
    en?: string;
    fr?: string;
    de?: string;
    es?: string;
    jp?: string;
  };

  public cost: number;

  public isActive: boolean;

  public isDeleted: boolean;

  constructor(ticketType?: any) {
    this.id = ticketType?.id || Guid.create().toString();
    if (!this.name) {
      this.name = { it: '', en: '' };
    }
    this.name.it = ticketType?.name?.it || '';
    this.name.en = ticketType?.name?.en || '';
    this.description = ticketType?.description || { it: '', en: '' };
    this.cost = ticketType?.cost || 0;

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
