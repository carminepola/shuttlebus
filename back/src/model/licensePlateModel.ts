import { Guid } from "guid-typescript";

export default class LicensePlateModel {
  public id?: string;
  public licensePlate: string;
  public imei: string;
  public name?: string;
  public enabled: boolean;

  constructor(licensePlate?: any) {
    this.id = licensePlate?.id || Guid.create().toString();
    this.licensePlate = licensePlate?.licensePlate || "";
    this.imei = licensePlate?.imei || "";
    this.name = licensePlate?.name || "";
    this.enabled = licensePlate?.enabled !== undefined ? licensePlate.enabled : true;
  }
}
