import { Db } from "mongodb";
import MomapDao from "../dao/momapDao";
import RoutesServices from "./routesServices";
import StopsServices from "../dao/stopsDao";
import dotenv from "dotenv";
import { logger } from "../..";

dotenv.config();

class momapServices {
  private momapDao: MomapDao;
  private routeServices: RoutesServices;
  private stopsServices: StopsServices;

  constructor(db: Db) {
    this.momapDao = new MomapDao(db);
    this.routeServices = new RoutesServices(db);
    this.stopsServices = new StopsServices(db);
  }

  async created() {
    try {
      let schedules: any = await this.routeServices.getListScheduleForBusId();
      let stops = await this.stopsServices.getAllActiveStops();
      let day = new Date().toISOString().split("T")[0];
      for (let i = 0; i < schedules.length; i++) {
        schedules[i].day = day;
        schedules[i].currentLat;
        schedules[i].currentLng;
        schedules[i].currentAngle;

        schedules[i].stops = schedules[i].stops.map((s: any) => {
          let stop: any = stops.find((t: any) => t.id === s.stopId);
          return {
            ...s,
            lat: stop.location.latitude,
            lng: stop.location.longitude,
            stopName: stop.name,
            arrivalTime: "",
            late: 0,
            previsionTime: "",
            distance: "",
            duration: "",
          };
        });
      }
      if (schedules.length > 0) {
        await this.momapDao.create(schedules);
      }
    } catch (error) {
      logger.error(error);
    }
  }

  async getCurrent() {
    try {
      let momap = await this.momapDao.getCurrent();
      return momap;
    } catch (error) {
      logger.error(error);
    }
  }
  async cron() {
    try {
      let momap = await this.momapDao.get();
      if (momap.length == 0) {
        await this.created();
      } else {
        for (let i = 0; i < momap.length; i++) {
          let schedule = momap[i];
          let busId = schedule.busId;

          let findIndex = schedule.stops.findIndex((t: any) => t.arrivalTime === "");

          schedule.currentLat = 0;
          schedule.currentLng = 0;
          schedule.currentAngle = 0;

          if (findIndex >= 0) {
            let stopTime = schedule.stops[findIndex].stopTimeMinutes;

            let now = new Date();
            let nowMinutes = now.getHours() * 60 + now.getMinutes();

            if (findIndex == 0) {
              if (nowMinutes + 30 < stopTime) {
                continue;
              }
            }
            let nextStop = { lat: schedule.stops[findIndex].lat, lng: schedule.stops[findIndex].lng };

            let position = await this.getPositionFromMomap(busId);
            schedule.currentLat = position.lat;
            schedule.currentLng = position.lng;
            schedule.currentAngle = position.angle;

            let currentPosition = {
              lat: schedule.currentLat,
              lng: schedule.currentLng,
            };
            if (findIndex == 0) {
              if (this.haversineDistance(currentPosition, nextStop) < 50) {
                schedule.stops[findIndex].arrivalTime = Math.floor(Date.now() / 1000);
              } else if (stopTime < nowMinutes) {
                schedule.stops[findIndex].late = nowMinutes - stopTime;
                try {
                  let osm: any = await this.getTravelInfo(currentPosition, nextStop);
                  schedule.stops[findIndex].distance = osm.distance_km;
                  schedule.stops[findIndex].duration = osm.duration_min;
                  schedule.stops[findIndex].previsionTime = osm.arrival_time;
                } catch (e) {
                  logger.error("OSM error", e);
                }
              }
            } else {
              let beforeStop = { lat: schedule.stops[findIndex - 1].lat, lng: schedule.stops[findIndex - 1].lng };

              if (this.isBusBetweenStops(currentPosition, beforeStop, nextStop)) {
                schedule.stops[findIndex].arrivalTime = Math.floor(Date.now() / 1000);
              } else if (stopTime < nowMinutes) {
                schedule.stops[findIndex].late = nowMinutes - stopTime;
                try {
                  let osm: any = await this.getTravelInfo(currentPosition, nextStop);
                  schedule.stops[findIndex].distance = osm.distance_km;
                  schedule.stops[findIndex].duration = osm.duration_min;
                  schedule.stops[findIndex].previsionTime = osm.arrival_time;
                } catch (e) {
                  logger.error("OSM error", e);
                }
              }
            }

            await this.momapDao.update(schedule);
          }
        }
      }
    } catch (error) {
      logger.error("Error cron momapServices:", error);
    }
  }
  async getPositionFromMomap(busId: string): Promise<{ lat: string; lng: string; angle: string }> {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", "Bearer " + process.env.MOMAP_JWT);

    const requestOptions = {
      method: "GET",
      headers: myHeaders,

      redirect: "follow" as RequestRedirect,
    };

    const response = await fetch("https://auth-api.momap.it/v1/Customers/Devices/deviceData?imei=" + busId, requestOptions);
    let result: any = await response.json();

    if (result) {
      return { lat: result.data.lat, lng: result.data.lng, angle: result.data.angle };
    }
    throw new Error("Error momap fetch");
  }

  isBusBetweenStops(busPosition: { lat: number; lng: number }, stop1: { lat: number; lng: number }, stop2: { lat: number; lng: number }): boolean {
    const ERROR_MARGIN = 50; // Margine d'errore in metri (per compensare imprecisioni GPS)

    // Calcola le distanze tra il bus e le fermate
    let distanceBusToStop1 = this.haversineDistance(busPosition, stop1);
    let distanceBusToStop2 = this.haversineDistance(busPosition, stop2);
    let distanceBetweenStops = this.haversineDistance(stop1, stop2);

    // Controlla se il bus si trova tra le due fermate
    if (Math.abs(distanceBusToStop1 + distanceBusToStop2 - distanceBetweenStops) < ERROR_MARGIN) {
      return true;
    } else {
      return false;
    }
  }
  haversineDistance(coord1: { lat: any; lng: any }, coord2: { lat: any; lng: any }) {
    const toRad = (x: any) => (x * Math.PI) / 180;
    const R = 6371e3; // Raggio della Terra in metri
    const φ1 = toRad(coord1.lat);
    const φ2 = toRad(coord2.lat);
    const Δφ = toRad(coord2.lat - coord1.lat);
    const Δλ = toRad(coord2.lng - coord1.lng);

    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  async getTravelInfo(start: { lat: number; lng: number }, end: { lat: number; lng: number }) {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=false`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.code === "Ok") {
        const distance_km = (data.routes[0].distance / 1000).toFixed(2); // Converti in km
        const duration_min = (data.routes[0].duration / 60).toFixed(2); // Converti in minuti

        // Calcola orario di arrivo
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + data.routes[0].duration * 1000);
        const arrivalTimeStr = arrivalTime.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

        return {
          distance_km: `${distance_km}`,
          duration_min: `${duration_min}`,
          arrival_time: `${arrivalTimeStr}`,
        };
      } else {
        throw new Error("Errore nella risposta open street map");
      }
    } catch (error) {
      console.error("Errore nella richiesta:", error);
      return null;
    }
  }
}

export default momapServices;
