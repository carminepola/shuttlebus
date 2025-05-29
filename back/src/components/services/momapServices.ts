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
        schedules[i].currentLat = 0;
        schedules[i].currentLng = 0;
        schedules[i].currentAngle = 0;

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
      return await this.momapDao.getCurrent();
    } catch (error) {
      logger.error(error);
    }
  }

  async cron() {
    try {
      let momap = await this.momapDao.get();

      if (momap.length === 0) {
        await this.created();
        return;
      }

      for (let i = 0; i < momap.length; i++) {
        let schedule = momap[i];
        let busId = schedule.busId;
        let now = new Date();
        let nowMinutes = now.getHours() * 60 + now.getMinutes();

        let findIndex = schedule.stops.findIndex((t: any) => t.arrivalTime === "" && t.stopTimeMinutes > nowMinutes - 10);

        schedule.currentLat = 0;
        schedule.currentLng = 0;
        schedule.currentAngle = 0;

        if (findIndex >= 0) {
          const stopTime = schedule.stops[findIndex].stopTimeMinutes;

          const firstStopTime = schedule.stops[0].stopTimeMinutes;
          const lastStopTime = schedule.stops[schedule.stops.length - 1].stopTimeMinutes;

          const corsaIniziata = nowMinutes >= firstStopTime;
          const corsaFinita = nowMinutes > lastStopTime + 15;

          if (!corsaIniziata || corsaFinita) {
            await this.momapDao.update(schedule);
            continue;
          }

          const nextStop = {
            lat: schedule.stops[findIndex].lat,
            lng: schedule.stops[findIndex].lng,
          };

          try {
            const position = await this.getPositionFromMomap(busId);
            schedule.currentLat = position.lat;
            schedule.currentLng = position.lng;
            schedule.currentAngle = position.angle;
          } catch (err) {
            logger.error("Errore nel recuperare la posizione da Momap", err);
            continue;
          }

          const currentPosition = {
            lat: schedule.currentLat,
            lng: schedule.currentLng,
          };

          if (findIndex == 0) {
            if (this.haversineDistance(currentPosition, nextStop) < 50) {
              schedule.stops[findIndex].arrivalTime = Math.floor(Date.now() / 1000);
            } else if (stopTime < nowMinutes) {
              schedule.stops[findIndex].late = nowMinutes - stopTime;
              try {
                const osm = await this.getTravelInfo(currentPosition, nextStop);
                if (osm) {
                  schedule.stops[findIndex].distance = osm.distance_km;
                  schedule.stops[findIndex].duration = osm.duration_min;
                  schedule.stops[findIndex].previsionTime = osm.arrival_time;
                }
              } catch (e) {
                logger.error("OSM error", e);
              }
            }
          } else {
            const beforeStop = {
              lat: schedule.stops[findIndex - 1].lat,
              lng: schedule.stops[findIndex - 1].lng,
            };

            if (this.isBusBetweenStops(currentPosition, beforeStop, nextStop) || this.isNear(currentPosition, nextStop)) {
              schedule.stops[findIndex].arrivalTime = Math.floor(Date.now() / 1000);
            } else if (stopTime < nowMinutes) {
              schedule.stops[findIndex].late = nowMinutes - stopTime;
              try {
                const osm = await this.getTravelInfo(currentPosition, nextStop);
                if (osm) {
                  schedule.stops[findIndex].distance = osm.distance_km;
                  schedule.stops[findIndex].duration = osm.duration_min;
                  schedule.stops[findIndex].previsionTime = osm.arrival_time;
                }
              } catch (e) {
                logger.error("OSM error", e);
              }
            }
          }

          schedule.nextStep = schedule.stops[findIndex];
          await this.momapDao.update(schedule);
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

    const response = await fetch(`https://auth-api.momap.it/v1/Customers/Devices/deviceData?imei=${busId}`, requestOptions);

    const result: any = await response.json();

    if (result && result.data) {
      return {
        lat: result.data.lat,
        lng: result.data.lng,
        angle: result.data.angle,
      };
    }

    throw new Error("Errore nel recupero dati da momap.it");
  }

  isNear(coord1: { lat: number; lng: number }, coord2: { lat: number; lng: number }): boolean {
    return this.haversineDistance(coord1, coord2) < 50;
  }

  isBusBetweenStops(busPosition: { lat: number; lng: number }, stop1: { lat: number; lng: number }, stop2: { lat: number; lng: number }): boolean {
    const distanceBusToStop1 = this.haversineDistance(busPosition, stop1);
    const distanceBusToStop2 = this.haversineDistance(busPosition, stop2);
    const distanceBetweenStops = this.haversineDistance(stop1, stop2);

    return Math.abs(distanceBusToStop1 + distanceBusToStop2 - distanceBetweenStops) < 50;
  }

  haversineDistance(coord1: { lat: any; lng: any }, coord2: { lat: any; lng: any }) {
    const toRad = (x: any) => (x * Math.PI) / 180;
    const R = 6371e3; // metri
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

    const response = await fetch(url);
    const data = await response.json();

    if (data.code === "Ok") {
      const distance_km = (data.routes[0].distance / 1000).toFixed(2);
      const duration_min = Math.round(data.routes[0].duration / 60);
      const arrival_time = new Date(Date.now() + duration_min * 60000).toISOString();

      return { distance_km, duration_min, arrival_time };
    }

    throw new Error("Errore da OSRM");
  }
}

export default momapServices;
