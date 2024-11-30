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
  public isActive: boolean;
 
  constructor(
    stops?: any
  ) {
    this.id = stops?.id || Guid.create().toString();
    this.name = stops?.name || "";
    this.description = stops?.description || { it: "", en: "" };
    this.image = stops?.image || "";
    this.location = stops?.location || { latitude: 0, longitude: 0 };
    this.isActive = stops?.isActive || false;
    if (!stops?.id) {
      this.createdAt = new Date().getTime();
    } 
    this.updatedAt = new Date().getTime();
  }
}


