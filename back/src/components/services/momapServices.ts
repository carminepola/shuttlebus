import { Db } from "mongodb";
import MomapDao from "../dao/momapDao";
import RoutesServices from "./routesServices";
import LicensePlateServices from "./licensePlateServices";
import dotenv from "dotenv";
import { logger } from "../..";
import { log } from "console";

dotenv.config();

class momapServices {
  private momapDao: MomapDao;
  private routeServices: RoutesServices;
  private licensePlateServices: LicensePlateServices;
  private db: Db;

  constructor(db: Db) {
    this.momapDao = new MomapDao(db);
    this.routeServices = new RoutesServices(db);
    this.licensePlateServices = new LicensePlateServices(db);
    this.db = db;
  }

  async created() {
    try {
      const schedules: any[] = await this.routeServices.getListScheduleForBusId();
      const day = new Date().toISOString().split("T")[0];

      for (const schedule of schedules) {
        schedule.day = day;
        schedule.positions = []; // Storico posizioni
        schedule.currentLat = null;
        schedule.currentLng = null;
        schedule.currentAngle = null;
        delete schedule.stops;
      }

      if (schedules.length > 0) {
        await this.momapDao.create(schedules);
      }
    } catch (error) {
      logger.error("Errore in created momapServices:", error);
    }
  }

  async getCurrent() {
    try {
      let route = await this.routeServices.getEnabledRoutes();

      let checkHours = this.getMinAndMaxDate(route);

      if (!this.getPositionEnabled(checkHours)) {
        return;
      }
      const momap = await this.momapDao.getCurrent();
      return momap;
    } catch (error) {
      logger.error("Errore in getCurrent momapServices:", error);
    }
  }

  async getUserDevices() {
    try {
      const headers = new Headers();
      headers.append("Content-Type", "application/json");
      headers.append("Authorization", `Bearer ${process.env.MOMAP_JWT}`);

      const url = `https://auth-api.momap.it/v1/Customers/Devices/userDevices`;
      const response = await fetch(url, { method: "GET", headers, redirect: "follow" as RequestRedirect });

      const result = await response.json();
      if (result?.success && result?.data) {
        return result.data;
      }

      throw new Error("Dati dispositivi non validi da Momap");
    } catch (error) {
      logger.error("Errore nel recupero dispositivi da Momap:", error);
      throw error;
    }
  }

  getPositionEnabled(checkHours: { minTime: any; maxTime: any }) {
    const { minTime, maxTime } = checkHours;
    // funzione per convertire "HH:mm" → minuti
    const toMinutes = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    // ora attuale
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    // conversioni
    const min = toMinutes(minTime);
    const max = toMinutes(maxTime) + 30;

    // check
    const isInRange = nowMinutes >= min && nowMinutes <= max;
    return isInRange;
  }

  getMinAndMaxDate(data: any) {
    const times = data.flatMap((route: any) => route.schedules.map((s: any) => s.departureTime));

    const minTime = times.reduce((min: any, t: any) => (t < min ? t : min));
    const maxTime = times.reduce((max: any, t: any) => (t > max ? t : max));

    return { minTime, maxTime };
  }
  async cron() {
    try {
      let route = await this.routeServices.getEnabledRoutes();

      let checkHours = this.getMinAndMaxDate(route);

      if (!this.getPositionEnabled(checkHours)) {
        return;
      }
      let momapEntries = await this.licensePlateServices.getAll();

      if (!momapEntries || momapEntries.length === 0) {
        return;
      }

      for (const bus of momapEntries) {
        try {
          // IMEI is now included in the momap entry from the database lookup
          const imei = bus.imei;
          if (bus.enable == false) {
            continue;
          }
          if (!imei) {
            logger.warn(`Nessun IMEI trovato per la targa ${bus.name}`);
            continue;
          }

          const position = await this.getPositionFromMomap(imei);

          const newPosition = {
            imei: bus.imei,
            name: bus.name,
            plate: bus.licensePlate,
            busId: bus.id,
            lat: parseFloat(position.lat),
            lng: parseFloat(position.lng),
            angle: parseFloat(position.angle),
            doors: position.doors,
            date: new Date().toISOString().split("T")[0],
            updatedFromMomap: position.updatedAt,
          };

          await this.momapDao.update(newPosition);
        } catch (err) {
          logger.error(`Errore nel recupero posizione per bus ${bus.name}:`, err);
        }
      }
    } catch (error) {
      logger.error("Errore in cron momapServices:", error);
    }
  }

  private async getPositionFromMomap(imei: string): Promise<{ lat: string; lng: string; angle: string; doors: any; updatedAt: string }> {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Authorization", `Bearer ${process.env.MOMAP_JWT}`);

    const url = `https://auth-api.momap.it/v1/Customers/Devices/deviceData?imei=${imei}`;
    const response = await fetch(url, { method: "GET", headers, redirect: "follow" as RequestRedirect });

    const result = await response.json();
    if (result?.data) {
      let params = JSON.parse(result.data.params);
      return {
        lat: result.data.lat,
        lng: result.data.lng,
        angle: result.data.angle,
        doors: params.doors,
        updatedAt: result.data.updated_at,
      };
    }

    throw new Error("Dati GPS non validi da Momap");
  }

  /**
   * Calcola la distanza in metri tra due coordinate GPS usando la formula di Haversine
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Raggio della Terra in metri
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Converte un orario in formato "HH:mm" in minuti dalla mezzanotte
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Ottiene lo stato di tutti gli autobus: linea, prossima fermata e stato di ritardo
   */
  async getBusStatus() {
    try {
      // Recupera le posizioni attuali degli autobus
      const currentPositions = await this.momapDao.getCurrent();

      // Recupera le schedule attive per oggi con i dettagli delle fermate
      const schedules = await this.routeServices.getListScheduleForBusId();

      // Recupera le rotte abilitate per ottenere i nomi delle linee
      const routes = await this.routeServices.getEnabledRoutes();

      // Crea una mappa delle fermate con le loro coordinate
      const stopsMap = new Map<string, { name: string; lat: number; lng: number }>();

      for (const route of routes) {
        for (const stop of route.stops) {
          // Recupera i dettagli della fermata dalla collection stops
          const stopDetails = await this.db.collection("stops").findOne({ id: stop.id });
          if (stopDetails) {
            stopsMap.set(stop.id, {
              name: stopDetails.name || stop.id,
              lat: stopDetails.location?.latitude || 0,
              lng: stopDetails.location?.longitude || 0,
            });
          }
        }
      }

      // Crea una mappa delle rotte per ottenere i nomi
      const routesMap = new Map<string, { id: string; name: { it: string; en: string } }>();
      for (const route of routes) {
        for (const schedule of route.schedules || []) {
          routesMap.set(schedule.id, {
            id: route.id,
            name: route.name,
          });
        }
      }

      // Calcola l'orario attuale in minuti
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Elabora ogni autobus
      const busStatusList = [];

      for (const busPosition of currentPositions) {
        const busId = busPosition.busId;
        const busLat = busPosition.currentLat;
        const busLng = busPosition.currentLng;
        const plate = busPosition.plate || null;
        const name = busPosition.name || null;

        // Trova le schedule per questo busId
        const busSchedules = schedules.find((s: any) => s.busId === busId);

        if (!busSchedules || !busSchedules.stops || busSchedules.stops.length === 0) {
          // Nessuna schedule trovata per questo bus
          busStatusList.push({
            busId: busId,
            plate: plate,
            name: name,
            line: null,
            nextStop: null,
            status: "no_schedule",
            delay: null,
            currentLat: busLat,
            currentLng: busLng,
          });
          continue;
        }

        // Trova la fermata più vicina all'autobus
        let closestStop = null;
        let minDistance = Infinity;

        for (const stop of busSchedules.stops) {
          const stopDetails = stopsMap.get(stop.stopId);
          if (stopDetails) {
            const distance = this.calculateDistance(busLat, busLng, stopDetails.lat, stopDetails.lng);
            if (distance < minDistance) {
              minDistance = distance;
              closestStop = stop;
            }
          }
        }

        if (!closestStop) {
          // Nessuna fermata trovata
          busStatusList.push({
            busId: busId,
            plate: plate,
            name: name,
            line: null,
            nextStop: null,
            status: "no_stop",
            delay: null,
            currentLat: busLat,
            currentLng: busLng,
          });
          continue;
        }

        // Determina la prossima fermata
        const stopIndex = busSchedules.stops.findIndex((s: any) => s.stopId === closestStop.stopId);
        let nextStop = null;

        if (stopIndex >= 0 && stopIndex < busSchedules.stops.length - 1) {
          nextStop = busSchedules.stops[stopIndex + 1];
        } else if (stopIndex === busSchedules.stops.length - 1) {
          // L'autobus è all'ultima fermata
          nextStop = null;
        }

        // Calcola il ritardo
        const stopTimeMinutes = this.timeToMinutes(closestStop.stopTime);
        let delay = null;
        let status = "on_time";

        if (currentMinutes > stopTimeMinutes) {
          delay = currentMinutes - stopTimeMinutes;
          status = "late";
        } else if (currentMinutes < stopTimeMinutes) {
          delay = stopTimeMinutes - currentMinutes;
          status = "early";
        }

        // Ottieni i dettagli della fermata
        const stopDetails = stopsMap.get(closestStop.stopId);
        const nextStopDetails = nextStop ? stopsMap.get(nextStop.stopId) : null;

        // Ottieni i dettagli della linea
        const routeDetails = routesMap.get(closestStop.scheduleId);

        busStatusList.push({
          busId: busId,
          plate: plate,
          name: name,
          line: routeDetails ? routeDetails.name : null,
          currentStop: {
            id: closestStop.stopId,
            name: stopDetails?.name || closestStop.stopId,
            scheduledTime: closestStop.stopTime,
            distance: Math.round(minDistance),
          },
          nextStop: nextStopDetails
            ? {
                id: nextStop.stopId,
                name: nextStopDetails.name || nextStop.stopId,
                scheduledTime: nextStop.stopTime,
              }
            : null,
          status: status,
          delay: delay,
          currentLat: busLat,
          currentLng: busLng,
        });
      }

      return busStatusList;
    } catch (error) {
      logger.error("Errore in getBusStatus momapServices:", error);
      throw error;
    }
  }
}

export default momapServices;
