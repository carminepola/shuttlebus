import { Guid } from "guid-typescript";

export default class LngModel {
  public id?: string;

  public txt: string;
 
  public it? :string;
  public en? :string;


  constructor(lng?: any) {

    this.txt = lng?.txt || "";
    this.id = lng?.id || Guid.create().toString(); 
    this.it = lng?.it || "";
    this.en = lng?.en || "";
  }
}
