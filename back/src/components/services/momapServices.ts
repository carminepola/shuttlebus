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

  constructor(db: Db) {
    this.momapDao = new MomapDao(db);
    this.routeServices = new RoutesServices(db);
    this.licensePlateServices = new LicensePlateServices(db);
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
}

export default momapServices;
