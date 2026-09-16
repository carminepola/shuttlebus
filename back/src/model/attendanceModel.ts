import { Guid } from "guid-typescript";

export default class AttendanceModel {
  public id?: string;
  public year: number;
  public month: number;
  public name: string;
  public days: Record<string, string>;
  public createdAt: number;
  public updatedAt: number;

  constructor(attendance?: any) {
    this.id = attendance?.id || Guid.create().toString();
    const year = Number(attendance?.year);
    const month = Number(attendance?.month);
    this.year = Number.isFinite(year) ? year : 0;
    this.month = Number.isFinite(month) ? month : 0;
    this.name = attendance?.name || "";
    this.days = attendance?.days || {};
    this.createdAt = attendance?.createdAt || new Date().getTime();
    this.updatedAt = new Date().getTime();
  }
}
