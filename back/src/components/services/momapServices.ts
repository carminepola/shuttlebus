import { Db } from "mongodb";
import MomapDao from "../dao/momapDao";
import RoutesServices from "./routesServices";
import LicensePlateServices from "./licensePlateServices";
import DepotSettingsServices from "./depotSettingsServices";
import dotenv from "dotenv";
import { logger } from "../..";
import { log } from "console";

dotenv.config();

class momapServices {
  private momapDao: MomapDao;
  private routeServices: RoutesServices;
  private licensePlateServices: LicensePlateServices;
  private depotSettingsServices: DepotSettingsServices;
  private db: Db;

  constructor(db: Db) {
    this.momapDao = new MomapDao(db);
    this.routeServices = new RoutesServices(db);
    this.licensePlateServices = new LicensePlateServices(db);
    this.depotSettingsServices = new DepotSettingsServices(db);
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

      // Recupera le impostazioni del deposito
      const depotSettings = await this.depotSettingsServices.get();
      if (!depotSettings || !depotSettings.depotLatitude || !depotSettings.depotLongitude) {
        logger.warn("Invalid depot settings retrieved, returning unfiltered bus list");
        return momap; // Return unfiltered list as fallback
      }

      // Filtra i bus che hanno completato le loro corse del giorno
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentTime = now;

      // Recupera le assegnazioni bus-schedule per oggi
      const assignments = await this.momapDao.getBusScheduleAssignments(today);

      // Crea una mappa delle assegnazioni per busId
      const busAssignmentsMap = new Map<string, any[]>();
      for (const assignment of assignments) {
        if (!busAssignmentsMap.has(assignment.busId)) {
          busAssignmentsMap.set(assignment.busId, []);
        }
        const assignmentsArray = busAssignmentsMap.get(assignment.busId);
        if (assignmentsArray) {
          assignmentsArray.push(assignment);
        }
      }

      // Filtra i bus che non hanno completato le loro corse
      const filteredMomap = momap.filter((bus: any) => {
        const busAssignments = busAssignmentsMap.get(bus.busId);

        // Se il bus non ha assegnazioni, includilo
        if (!busAssignments || busAssignments.length === 0) {
          return true;
        }

        // Verifica se il bus ha completato tutte le sue corse
        const lastAssignment = busAssignments[busAssignments.length - 1];
        const lastArrivalMinutes = this.timeToMinutes(lastAssignment.arrivalTime || depotSettings.defaultLastArrivalTime || "23:59");

        // Se l'orario attuale è dopo l'ultima corsa del bus + tolleranza configurabile, escludilo
        const tolerance = depotSettings.completedRouteTolerance || 30;
        if (currentMinutes > lastArrivalMinutes + tolerance) {
          logger.info(`❌ Bus ${bus.busId} (${bus.name}) ha completato tutte le sue corse per oggi (ultima: ${lastAssignment.arrivalTime}) - ESCLUSO DA getCurrent`);
          return false;
        }

        // Verifica se il bus è al deposito
        if (bus.currentLat && bus.currentLng) {
          const distanceToDepot = this.calculateDistance(bus.currentLat, bus.currentLng, depotSettings.depotLatitude, depotSettings.depotLongitude);

          if (distanceToDepot <= depotSettings.depotRadius) {
            logger.info(`❌ Bus ${bus.busId} (${bus.name}) è al deposito (distanza: ${Math.round(distanceToDepot)}m, raggio: ${depotSettings.depotRadius}m) - ESCLUSO DA getCurrent`);
            return false;
          }
        }

        // Verifica se il bus ha aggiornamenti GPS recenti
        if (bus.updatedFromMomap) {
          const lastUpdate = new Date(bus.updatedFromMomap);
          const minutesSinceLastUpdate = (currentTime.getTime() - lastUpdate.getTime()) / (1000 * 60);

          // Validate that the time difference is non-negative
          if (minutesSinceLastUpdate < 0) {
            logger.error(`Invalid GPS timestamp for bus ${bus.busId}: last update is in the future. This may indicate clock synchronization issues.`);
            return false; // Exclude the bus to avoid showing incorrect data
          }

          if (minutesSinceLastUpdate > depotSettings.gpsTimeout) {
            logger.info(
              `❌ Bus ${bus.busId} (${bus.name}) non ha aggiornamenti GPS recenti (ultimo: ${Math.round(minutesSinceLastUpdate)} min fa, timeout: ${depotSettings.gpsTimeout} min) - ESCLUSO DA getCurrent`,
            );
            return false;
          }
        }

        return true;
      });

      logger.info(`getCurrent: ${momap.length} bus totali, ${filteredMomap.length} bus attivi dopo il filtro`);
      return filteredMomap;
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
    // Extended from 30 to 120 minutes to account for delays and ensure buses
    // are still considered active even when running significantly behind schedule
    const max = toMinutes(maxTime) + 120;

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
   * Trova il segmento della route più vicino all'autobus proiettando
   * la posizione del bus sui segmenti tra fermate consecutive.
   * Usa coordinate cartesiane locali (lat, lng * cos(lat)) per il calcolo.
   */
  private findClosestRouteSegment(
    busLat: number,
    busLng: number,
    stops: any[],
    stopsMap: Map<string, { name: string; lat: number; lng: number }>
  ): { prevIndex: number; nextIndex: number; progress: number } | null {
    if (stops.length < 2) return null;

    const lats: number[] = [busLat];
    for (const stop of stops) {
      const d = stopsMap.get(stop.id);
      if (d) lats.push(d.lat);
    }
    const avgLatRad = (lats.reduce((a, b) => a + b, 0) / lats.length) * (Math.PI / 180);
    const cosLat = Math.cos(avgLatRad);

    let bestPrevIdx = 0;
    let bestNextIdx = 1;
    let bestDist = Infinity;
    let bestProgress = 0;

    for (let i = 0; i < stops.length - 1; i++) {
      const a = stopsMap.get(stops[i].id);
      const b = stopsMap.get(stops[i + 1].id);
      if (!a || !b) continue;

      const ax = a.lat;
      const ay = a.lng * cosLat;
      const bx = b.lat;
      const by = b.lng * cosLat;
      const px = busLat;
      const py = busLng * cosLat;

      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;

      let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const projX = ax + t * dx;
      const projY = ay + t * dy;
      const perpDist = Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);

      if (perpDist < bestDist) {
        bestDist = perpDist;
        bestProgress = t;
        bestPrevIdx = i;
        bestNextIdx = i + 1;
      }
    }

    return { prevIndex: bestPrevIdx, nextIndex: bestNextIdx, progress: bestProgress };
  }

  /**
   * Converte un orario in formato "HH:mm" in minuti dalla mezzanotte
   */
  private timeToMinutes(time: string): number {
    if (!time || typeof time !== "string") {
      const errorMsg = `Invalid time format: ${time}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    const parts = time.split(":");
    if (parts.length !== 2) {
      const errorMsg = `Invalid time format: ${time}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }
    const [hours, minutes] = parts.map(Number);
    if (isNaN(hours) || isNaN(minutes)) {
      const errorMsg = `Invalid time format: ${time}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    // Validate time ranges
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      const errorMsg = `Invalid time value: ${time}`;
      logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60) % 24;
    const m = Math.round(minutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private calculateRouteMetrics(
    stops: any[],
    stopsMap: Map<string, { name: string; lat: number; lng: number }>
  ): { totalDistance: number; scheduledTravelMinutes: number; avgSpeedMetersPerMin: number } {
    let totalDistance = 0;
    let prevCoords = stops.length > 0 ? stopsMap.get(stops[0].id) : null;

    for (let i = 1; i < stops.length; i++) {
      const coords = stopsMap.get(stops[i].id);
      if (prevCoords && coords) {
        totalDistance += this.calculateDistance(prevCoords.lat, prevCoords.lng, coords.lat, coords.lng);
      }
      prevCoords = coords;
    }

    const firstStopTime = this.timeToMinutes(stops[0].stopTime || "00:00");
    const lastStopTime = this.timeToMinutes(stops[stops.length - 1].stopTime || "00:00");
    const scheduledTravelMinutes = lastStopTime - firstStopTime;

    const avgSpeedMetersPerMin = scheduledTravelMinutes > 0 ? totalDistance / scheduledTravelMinutes : 0;

    return { totalDistance, scheduledTravelMinutes, avgSpeedMetersPerMin };
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

    // Initialize busIndex outside the route loop to maintain continuity across routes
    let busIndex = 0;

    for (const [routeId, schedules] of schedulesByRoute) {
      const routeAssignments: any[] = [];

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

      // Recupera le impostazioni del deposito
      const depotSettings = await this.depotSettingsServices.get();
      if (!depotSettings || !depotSettings.depotLatitude || !depotSettings.depotLongitude) {
        logger.warn("Invalid depot settings retrieved in getBusStatus, returning empty list");
        return []; // Return empty list as fallback to avoid errors
      }

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

        // Trova le schedule assegnate a questo bus, ordinate per orario di partenza
        const busAssignments = (busToScheduleMap.get(busId) || []).sort((a, b) => {
          return this.timeToMinutes(a.departureTime || "00:00") - this.timeToMinutes(b.departureTime || "00:00");
        });

        if (!busAssignments || busAssignments.length === 0) {
          // Nessuna schedule assegnata a questo bus
          busStatusList.push({
            busId: busId,
            plate: plate,
            name: name,
            line: null,
            nextStop: null,
            status: "no_schedule",
            currentLat: busLat,
            currentLng: busLng,
          });
          continue;
        }

        logger.debug(`Bus ${busId} ha ${busAssignments.length} assegnazioni`);

        // Verifica se il bus ha completato tutte le sue corse per oggi
        const lastAssignment = busAssignments[busAssignments.length - 1];
        const lastArrivalMinutes = lastAssignment ? this.timeToMinutes(lastAssignment.arrivalTime || depotSettings.defaultLastArrivalTime || "23:59") : 0;

        logger.debug(
          `Verifica completamento corse bus ${busId}: orario attuale=${currentMinutes}, ultima corsa=${lastArrivalMinutes}, soglia=${lastArrivalMinutes + (depotSettings.completedRouteTolerance || 30)}`,
        );

        // Se l'orario attuale è dopo l'ultima corsa del bus, non mostrarlo
        const tolerance = depotSettings.completedRouteTolerance || 30;
        if (lastAssignment && currentMinutes > lastArrivalMinutes + tolerance) {
          // +tolleranza minuti di tolleranza
          logger.info(`❌ Bus ${busId} ha completato tutte le sue corse per oggi (ultima: ${lastAssignment.arrivalTime}, attuale: ${currentMinutes}) - ESCLUSO DALLA LISTA`);
          // Non aggiungere questo bus alla lista degli stati
          continue;
        }

        logger.debug(`✅ Bus ${busId} NON ha completato le corse, procedo con l'elaborazione`);

        // Verifica se il bus è al deposito
        if (busLat && busLng) {
          const distanceToDepot = this.calculateDistance(busLat, busLng, depotSettings.depotLatitude, depotSettings.depotLongitude);

          if (distanceToDepot <= depotSettings.depotRadius) {
            logger.info(`❌ Bus ${busId} (${name}) è al deposito (distanza: ${Math.round(distanceToDepot)}m, raggio: ${depotSettings.depotRadius}m) - ESCLUSO DALLA LISTA`);
            continue;
          }
        }

        // Verifica se il bus ha aggiornamenti GPS recenti
        if (busPosition.updatedFromMomap) {
          const lastUpdate = new Date(busPosition.updatedFromMomap);
          const minutesSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);

          // Validate that the time difference is non-negative
          if (minutesSinceLastUpdate < 0) {
            logger.error(`Invalid GPS timestamp for bus ${busId}: last update is in the future. This may indicate clock synchronization issues.`);
            continue;
          }

          if (minutesSinceLastUpdate > depotSettings.gpsTimeout) {
            logger.info(
              `❌ Bus ${busId} (${name}) non ha aggiornamenti GPS recenti (ultimo: ${Math.round(minutesSinceLastUpdate)} min fa, timeout: ${depotSettings.gpsTimeout} min) - ESCLUSO DALLA LISTA`,
            );
            continue;
          }
        }

        // Trova la schedule attiva in questo momento per questo bus
        // Considera la posizione reale del bus rispetto alle fermate
        let activeAssignment = null;
        let bestAssignment = null;
        let minDistanceToRoute = Infinity;

        // Pre-calcola le coordinate delle fermate per evitare lookup ripetuti
        const stopCoordinatesMap = new Map<string, { lat: number; lng: number }>();
        for (const [stopId, stopDetails] of stopsMap.entries()) {
          stopCoordinatesMap.set(stopId, { lat: stopDetails.lat, lng: stopDetails.lng });
        }

        for (const assignment of busAssignments) {
          const departureMinutes = this.timeToMinutes(assignment.departureTime || "00:00");
          const arrivalMinutes = this.timeToMinutes(assignment.arrivalTime || depotSettings.defaultLastArrivalTime || "23:59");

          logger.debug(`Verifica schedule ${assignment.scheduleId}: ${assignment.departureTime} - ${assignment.arrivalTime} (attuale: ${currentMinutes})`);

          // Verifica se l'orario è nell'intervallo valido
          const isTimeValid = currentMinutes >= departureMinutes && currentMinutes <= arrivalMinutes;

          if (isTimeValid) {
            // Calcola la distanza del bus dalla prima fermata della schedule
            let assignmentDistance = Infinity;
            if (assignment.stops && assignment.stops.length > 0) {
              for (const stop of assignment.stops) {
                const coords = stopCoordinatesMap.get(stop.id);
                if (coords) {
                  const distance = this.calculateDistance(busLat, busLng, coords.lat, coords.lng);
                  if (distance < assignmentDistance) {
                    assignmentDistance = distance;
                  }
                }
              }
            }

            logger.debug(`Schedule ${assignment.scheduleId}: distanza dalla route = ${assignmentDistance}m`);

            // Se questa schedule è più vicina alla posizione reale del bus, usala
            if (assignmentDistance < minDistanceToRoute) {
              minDistanceToRoute = assignmentDistance;
              bestAssignment = assignment;
              logger.debug(`Schedule ${assignment.scheduleId} è la migliore (distanza: ${assignmentDistance}m)`);
            }

            // Se è già stata assegnata una schedule nell'intervallo orario, mantienila
            if (!activeAssignment) {
              activeAssignment = assignment;
              logger.info(`Bus ${busId} assegnato a schedule attiva ${assignment.scheduleId} (${assignment.departureTime})`);
            }
          }
        }

        // Se abbiamo trovato una schedule migliore basata sulla posizione, usala
        if (bestAssignment && !activeAssignment) {
          activeAssignment = bestAssignment;
          logger.info(`Bus ${busId} assegnato a schedule più vicina ${activeAssignment.scheduleId} (${activeAssignment.departureTime}) basata sulla posizione`);
        }

        // Se non c'è una schedule attiva, prendi la prossima per orario
        if (!activeAssignment) {
          let closestFutureAssignment = null;
          let closestFutureDistance = Infinity;

          for (const assignment of busAssignments) {
            const departureMinutes = this.timeToMinutes(assignment.departureTime || "00:00");
            if (departureMinutes > currentMinutes) {
              let assignmentDistance = Infinity;
              if (assignment.stops && assignment.stops.length > 0) {
                for (const stop of assignment.stops) {
                  const coords = stopCoordinatesMap.get(stop.id);
                  if (coords) {
                    const distance = this.calculateDistance(busLat, busLng, coords.lat, coords.lng);
                    if (distance < assignmentDistance) {
                      assignmentDistance = distance;
                    }
                  }
                }
              }
              logger.debug(`Schedule futura ${assignment.scheduleId} (${assignment.departureTime}): distanza = ${assignmentDistance}m`);

              if (assignmentDistance < closestFutureDistance) {
                closestFutureDistance = assignmentDistance;
                closestFutureAssignment = assignment;
              }
            }
          }

          if (closestFutureAssignment) {
            activeAssignment = closestFutureAssignment;
            logger.info(`Bus ${busId} assegnato a prossima schedule ${activeAssignment.scheduleId} (${activeAssignment.departureTime}) basata su orario e distanza (${closestFutureDistance}m)`);
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
            currentLat: busLat,
            currentLng: busLng,
          });
          continue;
        }

        // Determina la posizione del bus lungo la route usando la proiezione sui segmenti
        const segment = this.findClosestRouteSegment(busLat, busLng, activeAssignment.stops, stopsMap);

        let currentStop: any = null;
        let currentStopIndex: number = -1;
        let currentStopDistance: number = Infinity;

        if (!segment || activeAssignment.stops.length < 2) {
          for (let i = 0; i < activeAssignment.stops.length; i++) {
            const stop = activeAssignment.stops[i];
            const details = stopsMap.get(stop.id);
            if (details) {
              const dist = this.calculateDistance(busLat, busLng, details.lat, details.lng);
              if (dist < currentStopDistance) {
                currentStopDistance = dist;
                currentStop = stop;
                currentStopIndex = i;
              }
            }
          }
        } else {
          const prevStopData = activeAssignment.stops[segment.prevIndex];
          const nextStopData = activeAssignment.stops[segment.nextIndex];
          const prevDetails = stopsMap.get(prevStopData.id);
          const nextDetails = stopsMap.get(nextStopData.id);
          const distToPrev = prevDetails ? this.calculateDistance(busLat, busLng, prevDetails.lat, prevDetails.lng) : Infinity;
          const distToNext = nextDetails ? this.calculateDistance(busLat, busLng, nextDetails.lat, nextDetails.lng) : Infinity;

          if (distToNext < distToPrev) {
            currentStop = nextStopData;
            currentStopIndex = segment.nextIndex;
            currentStopDistance = distToNext;
          } else {
            currentStop = prevStopData;
            currentStopIndex = segment.prevIndex;
            currentStopDistance = distToPrev;
          }
        }

        if (!currentStop) {
          busStatusList.push({
            busId: busId,
            plate: plate,
            name: name,
            line: activeAssignment.routeName || null,
            nextStop: null,
            status: "no_stop",
            currentLat: busLat,
            currentLng: busLng,
          });
          continue;
        }

        // Determina la prossima fermata
        let nextStop = null;
        let isLastStop = currentStopIndex === activeAssignment.stops.length - 1;

        if (currentStopIndex >= 0 && !isLastStop) {
          nextStop = activeAssignment.stops[currentStopIndex + 1];
        }

        // Se il bus è all'ultima fermata, cerca la prossima corsa assegnata
        let nextAssignment = null;
        if (isLastStop) {
          const activeIndex = busAssignments.findIndex((a: any) => a.scheduleId === activeAssignment.scheduleId);
          if (activeIndex >= 0 && activeIndex < busAssignments.length - 1) {
            nextAssignment = busAssignments[activeIndex + 1];
            if (nextAssignment && nextAssignment.stops && nextAssignment.stops.length > 0) {
              nextStop = nextAssignment.stops[0];
              logger.info(`Bus ${busId} all'ultima fermata, carica prossima corsa ${nextAssignment.scheduleId} - prima fermata: ${nextStop.stopTime}`);
            }
          }
        }

        const currentStopDetails = stopsMap.get(currentStop.id);
        if (!currentStopDetails) {
          logger.warn(`Stop ${currentStop.id} not found in stopsMap for bus ${busId}, skipping this bus`);
          continue;
        }

        const today = new Date().toISOString().split("T")[0];
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const routeMetrics = this.calculateRouteMetrics(activeAssignment.stops, stopsMap);

        let status = "on_time";
        let estimatedArrival: string | null = null;
        let currentStopArrivalTime: string | null = null;
        let currentStopDepartureTime: string | null = null;

        const isAtStop = currentStopDistance < 120;

        if (isAtStop) {
          status = "on_spot";
          const existingEvent = await this.momapDao.getBusStopEvent(today, busId, activeAssignment.scheduleId, currentStop.id);
          if (existingEvent) {
            currentStopArrivalTime = existingEvent.arrivalTime || null;
            currentStopDepartureTime = existingEvent.departureTime || null;
            if (!currentStopArrivalTime) {
              currentStopArrivalTime = currentTimeStr;
              await this.momapDao.upsertBusStopEvent({ day: today, busId, scheduleId: activeAssignment.scheduleId, stopId: currentStop.id, arrivalTime: currentTimeStr });
            }
          } else {
            currentStopArrivalTime = currentTimeStr;
            await this.momapDao.upsertBusStopEvent({ day: today, busId, scheduleId: activeAssignment.scheduleId, stopId: currentStop.id, arrivalTime: currentTimeStr });
          }
        } else {
          status = "en_route";

          for (let i = 0; i <= currentStopIndex && i < activeAssignment.stops.length; i++) {
            const stopData = activeAssignment.stops[i];
            const prevEvent = await this.momapDao.getBusStopEvent(today, busId, activeAssignment.scheduleId, stopData.id);
            if (prevEvent && prevEvent.arrivalTime && !prevEvent.departureTime) {
              await this.momapDao.upsertBusStopEvent({ day: today, busId, scheduleId: activeAssignment.scheduleId, stopId: stopData.id, departureTime: prevEvent.arrivalTime });
            }
          }

          if (currentStopIndex >= 0) {
            const prevStopEvent = await this.momapDao.getBusStopEvent(today, busId, activeAssignment.scheduleId, currentStop.id);
            if (prevStopEvent) {
              currentStopArrivalTime = prevStopEvent.arrivalTime || null;
              currentStopDepartureTime = prevStopEvent.departureTime || null;
            }
          }
        }

        if (status === "en_route" && nextStop) {
          const nextCoords = stopsMap.get(nextStop.id);
          const distanceToNextStop = nextCoords ? this.calculateDistance(busLat, busLng, nextCoords.lat, nextCoords.lng) : 0;
          const timeToNextStop = routeMetrics.avgSpeedMetersPerMin > 0
            ? distanceToNextStop / routeMetrics.avgSpeedMetersPerMin
            : 0;
          estimatedArrival = this.minutesToTime(currentMinutes + timeToNextStop);
        }

        logger.debug(`Bus ${busId} fermata ${currentStop.id}: distanza=${currentStopDistance}m, status=${status}, arrivo_reale=${currentStopArrivalTime}, partenza_reale=${currentStopDepartureTime}, eta=${estimatedArrival}`);

        const stopDetails = stopsMap.get(currentStop.id);
        const nextStopDetails = nextStop ? stopsMap.get(nextStop.id) : null;

        busStatusList.push({
          busId: busId,
          plate: plate,
          name: name,
          line: activeAssignment.routeName || null,
          currentStop: {
            id: currentStop.id,
            name: stopDetails?.name || currentStop.id,
            scheduledTime: currentStop.stopTime,
            distance: Math.round(currentStopDistance),
            arrivalTime: currentStopArrivalTime,
            departureTime: currentStopDepartureTime,
          },
          nextStop: nextStopDetails
            ? {
                id: nextStop.id,
                name: nextStopDetails.name || nextStop.id,
                scheduledTime: nextStop.stopTime,
              }
            : null,
          status: status,
          estimatedArrival: estimatedArrival,
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
