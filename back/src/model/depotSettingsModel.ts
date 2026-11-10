import { Guid } from "guid-typescript";
import dotenv from "dotenv";

dotenv.config();

export default class DepotSettingsModel {
  public id?: string;
  public depotLatitude: number;
  public depotLongitude: number;
  public depotRadius: number; // in meters
  public gpsTimeout: number; // in minutes
  public completedRouteTolerance: number; // in minutes
  public defaultLastArrivalTime: string; // in "HH:mm" format

  constructor(settings?: any) {
    this.id = settings?.id || "default";
    this.depotLatitude = settings?.depotLatitude || parseFloat(process.env.DEFAULT_DEPOT_LATITUDE || "41.9028");
    this.depotLongitude = settings?.depotLongitude || parseFloat(process.env.DEFAULT_DEPOT_LONGITUDE || "12.4964");
    this.depotRadius = settings?.depotRadius || parseInt(process.env.DEFAULT_DEPOT_RADIUS || "500");
    this.gpsTimeout = settings?.gpsTimeout || parseInt(process.env.DEFAULT_GPS_TIMEOUT || "15");
    this.completedRouteTolerance = settings?.completedRouteTolerance || parseInt(process.env.DEFAULT_COMPLETED_ROUTE_TOLERANCE || "30");
    this.defaultLastArrivalTime = settings?.defaultLastArrivalTime || process.env.DEFAULT_LAST_ARRIVAL_TIME || "23:59";
  }
}
