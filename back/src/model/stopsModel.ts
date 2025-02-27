import { Guid } from "guid-typescript";

export default class StopModel {
  public id?: string;
  public createdAt?: number;
  public updatedAt?: number;
  public name?: string;
  public description?: {
    it?: string;
    en?: string;
  };
  public image?: string;
  public location: {
    latitude: number;
    longitude: number;
  };
  public address: string;
  public isDeleted?: boolean;
  public isActive: boolean;

  constructor(stops?: any) {
    debugger;
    this.id = stops?.id || Guid.create().toString();
    this.name = stops?.name || "";
    this.description = stops?.description || { it: "", en: "" };
    this.image = stops?.image || "";
    this.location = stops?.location || { latitude: 0, longitude: 0 };
    this.isActive = stops?.isActive == false ? false : true;
    this.isDeleted = stops?.isDeleted == true ? true : false;
    this.address = stops?.address || "";
    if (!stops?.id) {
      this.createdAt = new Date().getTime();
    } else if (stops?.createdAt) {
      this.createdAt = stops.createdAt;
    }
    this.updatedAt = new Date().getTime();
  }
}
