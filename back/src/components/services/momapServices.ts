import { Db } from "mongodb";
import MomapDao from "../dao/momapDao";
import RoutesServices from "./routesServices";
import dotenv from "dotenv";
import { logger } from "../..";

dotenv.config();

class momapServices {
  private momapDao: MomapDao;
  private routeServices: RoutesServices;

  constructor(db: Db) {
    this.momapDao = new MomapDao(db);
    this.routeServices = new RoutesServices(db);
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

  async cron() {
    try {
      let momapEntries = await this.momapDao.get();
      const today = new Date().toISOString().split("T")[0];

      if (!Array.isArray(momapEntries) || momapEntries.length === 0 || !momapEntries.some((e: any) => e.day === today)) {
        await this.created();
        momapEntries = await this.momapDao.get();
      }

      const now = Math.floor(Date.now() / 1000);

      for (const schedule of momapEntries) {
        const busId = schedule.busId;

        try {
          const position = await this.getPositionFromMomap(busId);

          const newPosition = {
            lat: parseFloat(position.lat),
            lng: parseFloat(position.lng),
            angle: parseFloat(position.angle),
            timestamp: now,
          };

          schedule.currentLat = newPosition.lat;
          schedule.currentLng = newPosition.lng;
          schedule.currentAngle = newPosition.angle;

          if (!Array.isArray(schedule.positions)) {
            schedule.positions = [];
          }

          let update = true;
          if (schedule.positions.length > 0) {
            let lastPosition = schedule.positions[schedule.positions.length - 1];
            if (lastPosition.angle === newPosition.angle && lastPosition.lat === newPosition.lat && lastPosition.lng === newPosition.lng) {
              update = false;
            }
          }
          if (update) {
            schedule.positions.push(newPosition);
            await this.momapDao.update(schedule);
          }
        } catch (err) {
          logger.error(`Errore nel recupero posizione per bus ${busId}:`, err);
        }
      }
    } catch (error) {
      logger.error("Errore in cron momapServices:", error);
    }
  }

  private async getPositionFromMomap(busId: string): Promise<{ lat: string; lng: string; angle: string }> {
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    headers.append("Authorization", `Bearer ${process.env.MOMAP_JWT}`);

    const url = `https://auth-api.momap.it/v1/Customers/Devices/deviceData?imei=${busId}`;
    const response = await fetch(url, { method: "GET", headers, redirect: "follow" as RequestRedirect });

    const result = await response.json();
    if (result?.data) {
      return {
        lat: result.data.lat,
        lng: result.data.lng,
        angle: result.data.angle,
      };
    }

    throw new Error("Dati GPS non validi da Momap");
  }
}

export default momapServices;
