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
        schedule.positions = []; // nuova proprietà per tracciare la cronologia
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
      const momapEntries = await this.momapDao.get();
      const now = Math.floor(Date.now() / 1000);

      for (const schedule of momapEntries) {
        const busId = schedule.busId;

        try {
          const position = await this.getPositionFromMomap(busId);

          // Salva la posizione attuale nel campo positions[]
          const newPosition = {
            lat: parseFloat(position.lat),
            lng: parseFloat(position.lng),
            angle: parseFloat(position.angle),
            timestamp: now,
          };

          schedule.currentLat = newPosition.lat;
          schedule.currentLng = newPosition.lng;
          schedule.currentAngle = newPosition.angle;

          if (!schedule.positions) schedule.positions = [];
          schedule.positions.push(newPosition);

          await this.momapDao.update(schedule);
        } catch (err) {
          logger.error(`Errore nel recupero posizione per bus ${busId}:`, err);
        }
      }
    } catch (error) {
      logger.error("Errore in cron momapServices:", error);
    }
  }

  private async getPositionFromMomap(busId: string): Promise<{ lat: string; lng: string; angle: string }> {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", `Bearer ${process.env.MOMAP_JWT}`);

    const response = await fetch(`https://auth-api.momap.it/v1/Customers/Devices/deviceData?imei=${busId}`, { method: "GET", headers: myHeaders, redirect: "follow" as RequestRedirect });

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
