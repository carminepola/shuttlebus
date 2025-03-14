import { Db, MongoClient } from "mongodb";
import { RouteDAO } from "../dao/routeDao";
import { Route, Stop, Schedule, ScheduleStop } from "../../model/routesModel";
import ErrorModel from "../../model/errorModel";
import { Guid } from "guid-typescript";

export default class RoutesServices {
  private routeDao: RouteDAO;

  constructor(db: Db) {
    this.routeDao = new RouteDAO(db);
  }

  insertRoute(route: Partial<Route>) {
    route.id = Guid.create().toString();
    route.stops = route.stops || [];
    route.stops.forEach((stop, index) => {
      stop.position = index;
    });
    route.enabled = true;
    route.ticketTypes = route.ticketTypes || [];
    return this.routeDao.insertRoute(route);
  }

  updateRoute(nameIt: string, nameEn: string, stops: Stop[], ticketTypes: string[], routeId: string, enabled: boolean) {
    return this.routeDao.updateRoute(nameIt, nameEn, stops, ticketTypes, routeId, enabled);
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
    return this.routeDao.insertSchedule(schedule, routeId);
  }
  updateSchedule(scheduleId: string, schedule: Partial<Schedule>, routeId: string) {
    return this.routeDao.updateSchedule(scheduleId, schedule, routeId);
  }
  getRoutesToDay() {
    return this.routeDao.routesToDay();
  }
}
