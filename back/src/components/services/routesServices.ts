import { Db, MongoClient } from "mongodb";
import { RouteDAO } from "../dao/routeDao";
import { Route, Stop, Schedule, ScheduleStop } from "../../model/routesModel";
import ErrorModel from "../../model/errorModel";
import { Guid } from "guid-typescript";
import { sanitizeFares, sanitizeLuggagePrice } from "../../utils/fares";
import { pickLanguageStrings } from "../../i18n/languages";
import { LUGGAGE_PRICE } from "../../constants";

export default class RoutesServices {
  private routeDao: RouteDAO;

  constructor(db: Db) {
    this.routeDao = new RouteDAO(db);
  }

  insertRoute(route: Partial<Route>) {
    route.id = Guid.create().toString();
    route.name = pickLanguageStrings(route.name, 200);
    route.stops = route.stops || [];
    route.stops.forEach((stop, index) => {
      stop.position = index;
    });
    route.enabled = true;
    route.ticketTypes = route.ticketTypes || [];
    route.fares = sanitizeFares(route.fares, route.stops, route.ticketTypes);
    return this.routeDao.insertRoute(route);
  }

  updateRoute(name: any, stops: Stop[], ticketTypes: string[], routeId: string, enabled: boolean, fares?: any) {
    // fares assente (client vecchio): le tariffe salvate restano invariate
    const cleanFares = fares === undefined ? undefined : sanitizeFares(fares, stops, ticketTypes);
    return this.routeDao.updateRoute(pickLanguageStrings(name, 200), stops, ticketTypes, routeId, enabled, cleanFares);
  }

  getRoutes() {
    return this.routeDao.getRoutes();
  }
  getRouteById(id: string) {
    return this.routeDao.getRouteById(id);
  }
  deleteRoute(id: string) {
    return this.routeDao.deleteRoute(id);
  }
  getEnabledRoutes() {
    return this.routeDao.getEnabledRoutes();
  }

  /**
   * Inserts a new schedule in the given route.
   * @param {Partial<Schedule>} schedule the schedule to be inserted
   * @param {string} routeId the id of the route
   * @returns {Promise<boolean>} true if the schedule is inserted, false otherwise
   */
  insertSchedule(schedule: Partial<Schedule>, routeId: string) {
    schedule.id = Guid.create().toString();
    schedule.status = "active";
    schedule.luggagePrice = this.checkLuggagePrice(schedule.luggagePrice) ?? LUGGAGE_PRICE;
    return this.routeDao.insertSchedule(schedule, routeId);
  }
  updateSchedule(scheduleId: string, schedule: Partial<Schedule>, routeId: string) {
    if (schedule && "luggagePrice" in schedule) {
      const price = this.checkLuggagePrice(schedule.luggagePrice);
      if (price === undefined) delete schedule.luggagePrice;
      else schedule.luggagePrice = price;
    }
    return this.routeDao.updateSchedule(scheduleId, schedule, routeId);
  }
  /** undefined se non indicato; errore 400 se indicato ma non valido. */
  private checkLuggagePrice(value: any): number | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    const price = sanitizeLuggagePrice(value);
    if (price === null) throw new ErrorModel(400, "Prezzo bagaglio non valido");
    return price;
  }
  getRoutesToDay() {
    return this.routeDao.routesToDay();
  }
  getRoutesToDayList() {
    return this.routeDao.routesToDayList();
  }
  getCurrentSchedules() {
    return this.routeDao.currentSchedules();
  }
  getListScheduleForBusId() {
    return this.routeDao.listScheduleForBusId();
  }
}
