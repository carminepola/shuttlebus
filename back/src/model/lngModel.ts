import { Guid } from 'guid-typescript';

export default class LngModel {
  public id?: string;

  public txt: string;

  public it?: string;

  public en?: string;

  public fr?: string;

  public de?: string;

  public es?: string;

  public jp?: string;

  constructor(lng?: any) {
    this.txt = lng?.txt || '';
    this.id = lng?.id || Guid.create().toString();
    this.it = lng?.it || '';
    this.en = lng?.en || '';
    this.fr = lng?.fr || '';
    this.de = lng?.de || '';
    this.es = lng?.es || '';
    this.jp = lng?.jp || '';
  }
}
