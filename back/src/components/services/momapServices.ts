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

  private dateToNumber(date: string): number {
    return parseInt(date.replace(/-/g, ""));
  }
  /**
   * Ottiene tutte le schedule attive per oggi (senza dipendenza da busId)
   */
  private async getTodaySchedules(routes: any[]): Promise<any[]> {
    const todayDate = new Date().toISOString().split("T")[0];
    const todayDayOfWeek = (new Date().getDay() + 6) % 7; // Lunedì = 0, Domenica = 6

    logger.info(`Ricerca schedule per oggi: ${todayDate}, giorno della settimana: ${todayDayOfWeek}`);
    logger.info(`Analisi di ${routes.length} routes`);

    const todaySchedules: any[] = [];
    let totalSchedules = 0;

    for (const route of routes) {
      if (!route.schedules) {
        logger.debug(`Route ${route.id} (${route.name?.it || "N/A"}) non ha schedules`);
        continue;
      }

      logger.debug(`Route ${route.id} (${route.name?.it || "N/A"}) ha ${route.schedules.length} schedules`);

      for (const schedule of route.schedules) {
        totalSchedules++;

        logger.debug(`Analisi schedule ${schedule.id}:`);
        logger.debug(`  - Status: ${schedule.status}`);
        logger.debug(`  - StartDate: ${schedule.startDate}, EndDate: ${schedule.endDate}`);
        logger.debug(`  - DaysOfWeek: ${JSON.stringify(schedule.daysOfWeek)}`);
        logger.debug(`  - ExtraDates: ${JSON.stringify(schedule.extraDates)}`);
        logger.debug(`  - ExcludedDates: ${JSON.stringify(schedule.excludedDates)}`);
        logger.debug(`  - DepartureTime: ${schedule.departureTime}`);

        // Verifica se la schedule è attiva per oggi
        if (schedule.status !== "active") {
          logger.debug(`  ❌ Schedule ${schedule.id} non è attiva (stato: ${schedule.status})`);
          continue;
        }

        // Verifica che la data di oggi sia compresa tra startDate e endDate
        const startDateNum = this.dateToNumber(schedule.startDate);
        const endDateNum = this.dateToNumber(schedule.endDate);
        const todayNum = this.dateToNumber(todayDate);

        if (startDateNum > todayNum || endDateNum < todayNum) {
          logger.debug(`  ❌ Schedule ${schedule.id} non valida per oggi (${schedule.startDate} - ${schedule.endDate})`);
          continue;
        }

        // Verifica se oggi è una data esclusa
        if (schedule.excludedDates && schedule.excludedDates.includes(todayDate)) {
          logger.debug(`  ❌ Schedule ${schedule.id} esclusa per oggi`);
          continue;
        }

        // Verifica se oggi è una data extra
        const isExtraDate = schedule.extraDates && schedule.extraDates.includes(todayDate);

        // Verifica se oggi è un giorno della settimana valido
        // Se daysOfWeek è vuoto o non definito, la schedule è valida tutti i giorni
        let isValidDayOfWeek = true;
        if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
          isValidDayOfWeek = schedule.daysOfWeek.includes(todayDayOfWeek);
        }

        if (!isExtraDate && !isValidDayOfWeek) {
          logger.debug(`  ❌ Schedule ${schedule.id} non valida per questo giorno della settimana (daysOfWeek: ${JSON.stringify(schedule.daysOfWeek)}, oggi: ${todayDayOfWeek})`);
          continue;
        }

        // Aggiungi la schedule alla lista
        logger.info(`  ✅ Schedule ${schedule.id} valida per oggi - Route: ${route.id} (${route.name?.it || "N/A"}), Partenza: ${schedule.departureTime}`);
        todaySchedules.push({
          ...schedule,
          routeId: route.id,
          routeName: route.name,
        });
      }
    }

    logger.info(`Analizzate ${totalSchedules} schedule totali, trovate ${todaySchedules.length} schedule valide per oggi`);

    return todaySchedules;
  }

  /**
   * Genera dinamicamente la tabella delle assegnazioni bus-schedule
   * I bus sono intercambiabili e si alternano in base alla disponibilità
   * La funzione è idempotente: se esistono già assegnazioni per oggi, le riutilizza
   */
  private async generateBusScheduleTable(routes: any[], currentPositions: any[]) {
    const today = new Date().toISOString().split("T")[0];

    logger.info(`Generazione tabella assegnazioni per ${today}`);
    logger.info(`Bus disponibili: ${currentPositions.length}`);

    // Verifica se esistono già assegnazioni per oggi (idempotenza)
    const hasAssignments = await this.momapDao.hasBusScheduleAssignments(today);

    if (hasAssignments) {
      // Recupera le assegnazioni esistenti dal database
      const savedAssignments = await this.momapDao.getBusScheduleAssignments(today);

      // Converti le assegnazioni salvate nel formato Map
      const busScheduleAssignments = new Map<string, any[]>();
      for (const assignment of savedAssignments) {
        if (!busScheduleAssignments.has(assignment.routeId)) {
          busScheduleAssignments.set(assignment.routeId, []);
        }
        busScheduleAssignments.get(assignment.routeId)!.push({
          scheduleId: assignment.scheduleId,
          busId: assignment.busId,
          departureTime: assignment.departureTime,
          arrivalTime: assignment.arrivalTime,
          stops: assignment.stops,
          routeId: assignment.routeId,
          routeName: assignment.routeName,
        });
      }

      logger.info(`Recuperate ${savedAssignments.length} assegnazioni esistenti per ${today}`);
      return busScheduleAssignments;
    }

    // Se non esistono assegnazioni, generale nuove
    logger.info(`Generazione nuove assegnazioni per ${today}`);

    // Ottieni tutte le schedule attive per oggi
    const todaySchedules = await this.getTodaySchedules(routes);

    if (todaySchedules.length === 0) {
      logger.warn(`Nessuna schedule valida trovata per ${today}`);
      return new Map<string, any[]>();
    }

    // Ordina le schedule per orario di partenza
    todaySchedules.sort((a, b) => {
      const timeA = this.timeToMinutes(a.departureTime || "00:00");
      const timeB = this.timeToMinutes(b.departureTime || "00:00");
      return timeA - timeB;
    });

    // Raggruppa le schedule per route
    const schedulesByRoute = new Map<string, any[]>();
    for (const schedule of todaySchedules) {
      if (!schedulesByRoute.has(schedule.routeId)) {
        schedulesByRoute.set(schedule.routeId, []);
      }
      schedulesByRoute.get(schedule.routeId)!.push(schedule);
    }

    logger.info(`Schedule raggruppate per ${schedulesByRoute.size} routes`);

    // Crea un tracker della disponibilità dei bus
    const busAvailability = new Map<
      string,
      {
        busId: string;
        plate: string;
        name: string;
        currentLat: number;
        currentLng: number;
        lastAssignedScheduleId: string | null;
        lastAssignmentTime: number;
      }
    >();

    for (const bus of currentPositions) {
      busAvailability.set(bus.busId, {
        busId: bus.busId,
        plate: bus.plate,
        name: bus.name,
        currentLat: bus.currentLat,
        currentLng: bus.currentLng,
        lastAssignedScheduleId: null,
        lastAssignmentTime: 0,
      });
    }

    // Assegna i bus alle schedule in rotazione
    const busScheduleAssignments = new Map<string, any[]>();
    const availableBuses = Array.from(busAvailability.values());
    const assignmentsToSave: any[] = [];

    logger.info(`Inizio assegnazione bus alle schedule (${availableBuses.length} bus disponibili)`);

    for (const [routeId, schedules] of schedulesByRoute) {
      const routeAssignments: any[] = [];
      let busIndex = 0;

      for (const schedule of schedules) {
        // Trova il prossimo bus disponibile (rotazione)
        const assignedBus = availableBuses[busIndex % availableBuses.length];

        const assignment = {
          day: today,
          scheduleId: schedule.id,
          busId: assignedBus.busId,
          departureTime: schedule.departureTime,
          arrivalTime: schedule.arrivalTime,
          stops: schedule.stops,
          routeId: routeId,
          routeName: schedule.routeName,
        };

        routeAssignments.push(assignment);
        assignmentsToSave.push(assignment);

        logger.info(`Assegnato bus ${assignedBus.busId} (${assignedBus.name}) a schedule ${schedule.id} (${schedule.departureTime})`);

        // Aggiorna il tracking dell'assegnazione del bus
        const busInfo = busAvailability.get(assignedBus.busId)!;
        busInfo.lastAssignedScheduleId = schedule.id;
        busInfo.lastAssignmentTime = this.timeToMinutes(schedule.departureTime || "00:00");

        busIndex++;
      }

      busScheduleAssignments.set(routeId, routeAssignments);
    }

    // Salva le assegnazioni nel database per futuri utilizzi
    await this.momapDao.saveBusScheduleAssignments(today, assignmentsToSave);
    logger.info(`Salvate ${assignmentsToSave.length} assegnazioni per ${today}`);

    return busScheduleAssignments;
  }

  /**
   * Ottiene lo stato di tutti gli autobus: linea, prossima fermata e stato di ritardo
   */
  async getBusStatus() {
    try {
      logger.info("Inizio getBusStatus");

      // Recupera le posizioni attuali degli autobus
      const currentPositions = await this.momapDao.getCurrent();
      logger.info(`Recuperate ${currentPositions.length} posizioni bus attuali`);

      // Recupera le rotte abilitate
      const routes = await this.routeServices.getEnabledRoutes();
      logger.info(`Recuperate ${routes.length} rotte abilitate`);

      // Genera dinamicamente la tabella delle assegnazioni bus-schedule
      let busScheduleAssignments: Map<string, any[]>;
      try {
        busScheduleAssignments = await this.generateBusScheduleTable(routes, currentPositions);
        logger.info(`Generate assegnazioni per ${busScheduleAssignments.size} routes`);
      } catch (error) {
        logger.error("Errore durante la generazione delle assegnazioni bus-schedule:", error);
        throw error;
      }

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

      logger.info(`Caricate ${stopsMap.size} fermate nella mappa`);

      // Calcola l'orario attuale in minuti
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      logger.info(`Orario attuale: ${now.toISOString()} (${currentMinutes} minuti)`);

      // Crea una mappa inversa: busId -> assegnazioni schedule
      const busToScheduleMap = new Map<string, any[]>();
      for (const [routeId, assignments] of busScheduleAssignments) {
        for (const assignment of assignments) {
          if (!busToScheduleMap.has(assignment.busId)) {
            busToScheduleMap.set(assignment.busId, []);
          }
          busToScheduleMap.get(assignment.busId)!.push(assignment);
        }
      }

      logger.info(`Creato mappa inversa per ${busToScheduleMap.size} bus`);

      // Elabora ogni autobus
      const busStatusList = [];

      for (const busPosition of currentPositions) {
        const busId = busPosition.busId;
        const busLat = busPosition.currentLat;
        const busLng = busPosition.currentLng;
        const plate = busPosition.plate || null;
        const name = busPosition.name || null;

        logger.debug(`Elaborazione bus ${busId} (${name})`);

        // Trova le schedule assegnate a questo bus
        const busAssignments = busToScheduleMap.get(busId);

        if (!busAssignments || busAssignments.length === 0) {
          // Nessuna schedule assegnata a questo bus
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

        logger.debug(`Bus ${busId} ha ${busAssignments.length} assegnazioni`);

        // Trova la schedule attiva in questo momento per questo bus
        let activeAssignment = null;
        for (const assignment of busAssignments) {
          const departureMinutes = this.timeToMinutes(assignment.departureTime || "00:00");
          const arrivalMinutes = this.timeToMinutes(assignment.arrivalTime || "23:59");

          logger.debug(`Verifica schedule ${assignment.scheduleId}: ${assignment.departureTime} - ${assignment.arrivalTime} (attuale: ${currentMinutes})`);

          if (currentMinutes >= departureMinutes && currentMinutes <= arrivalMinutes) {
            activeAssignment = assignment;
            logger.info(`Bus ${busId} assegnato a schedule attiva ${assignment.scheduleId} (${assignment.departureTime})`);
            break;
          }
        }

        // Se non c'è una schedule attiva, prendi la prossima
        if (!activeAssignment) {
          for (const assignment of busAssignments) {
            const departureMinutes = this.timeToMinutes(assignment.departureTime || "00:00");
            if (departureMinutes > currentMinutes) {
              activeAssignment = assignment;
              logger.info(`Bus ${busId} assegnato a prossima schedule ${assignment.scheduleId} (${assignment.departureTime})`);
              break;
            }
          }
        }

        // Se ancora non c'è una schedule, prendi l'ultima del giorno
        if (!activeAssignment && busAssignments.length > 0) {
          activeAssignment = busAssignments[busAssignments.length - 1];
          logger.info(`Bus ${busId} assegnato all'ultima schedule ${activeAssignment.scheduleId} (${activeAssignment.departureTime})`);
        }

        if (!activeAssignment || !activeAssignment.stops || activeAssignment.stops.length === 0) {
          logger.warn(`Bus ${busId}: nessuna schedule valida trovata o nessuna fermata nella schedule`);
          // Nessuna schedule valida trovata
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

        for (const stop of activeAssignment.stops) {
          const stopDetails = stopsMap.get(stop.id);
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
            line: activeAssignment.routeName || null,
            nextStop: null,
            status: "no_stop",
            delay: null,
            currentLat: busLat,
            currentLng: busLng,
          });
          continue;
        }

        // Determina la prossima fermata
        const stopIndex = activeAssignment.stops.findIndex((s: any) => s.id === closestStop.id);
        let nextStop = null;

        if (stopIndex >= 0 && stopIndex < activeAssignment.stops.length - 1) {
          nextStop = activeAssignment.stops[stopIndex + 1];
        } else if (stopIndex === activeAssignment.stops.length - 1) {
          // L'autobus è all'ultima fermata
          nextStop = null;
        }

        // Calcola il ritardo
        const stopTimeMinutes = this.timeToMinutes(closestStop.stopTime || "00:00");
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
        const stopDetails = stopsMap.get(closestStop.id);
        const nextStopDetails = nextStop ? stopsMap.get(nextStop.id) : null;

        busStatusList.push({
          busId: busId,
          plate: plate,
          name: name,
          line: activeAssignment.routeName || null,
          currentStop: {
            id: closestStop.id,
            name: stopDetails?.name || closestStop.id,
            scheduledTime: closestStop.stopTime,
            distance: Math.round(minDistance),
          },
          nextStop: nextStopDetails
            ? {
                id: nextStop.id,
                name: nextStopDetails.name || nextStop.id,
                scheduledTime: nextStop.stopTime,
              }
            : null,
          status: status,
          delay: delay,
          currentLat: busLat,
          currentLng: busLng,
        });
      }

      logger.info(`Generati ${busStatusList.length} stati bus`);
      return busStatusList;
    } catch (error) {
      logger.error("Errore in getBusStatus momapServices:", error);
      throw error;
    }
  }
}

export default momapServices;
