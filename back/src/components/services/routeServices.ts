import { Db, MongoClient } from "mongodb";
import { RouteDAO } from "../dao/routeDao";
import { Route, Stop, TicketType } from "../../model/routeModel";
import ErrorModel from "../../model/errorModel";

class RouteServices {
  private routeDao: RouteDAO;

  constructor(db: Db, client: MongoClient) {
    this.routeDao = new RouteDAO(db, client);
  }

  async createRoute(route: Route) {
    try {
      const result = await this.routeDao.createRoute(route);
      return result;
    } catch (error) {
      throw new ErrorModel(500, "Errore nella creazione della Route");
    }
  }

  async getRouteById(routeId: string) {
    try {
      const result = await this.routeDao.getRouteById(routeId);
      if (!result) {
        throw new ErrorModel(404, "Route non trovata");
      }
      return result;
    } catch (error) {
      throw error;
    }
  }

  async addStopToRoute(routeId: string, stop: Stop) {
    try {
      const result = await this.routeDao.addStopToRoute(routeId, stop);
      return result;
    } catch (error) {
      throw new ErrorModel(500, "Errore nell'aggiunta della fermata");
    }
  }

  async disableStopInRoute(routeId: string, stopId: string) {
    try {
      const result = await this.routeDao.disableStopInRoute(routeId, stopId);
      return result;
    } catch (error) {
      throw new ErrorModel(500, "Errore nella disabilitazione della fermata");
    }
  }

  async addTicketTypeToRoute(routeId: string, ticketType: TicketType) {
    try {
      const result = await this.routeDao.addTicketTypeToRoute(routeId, ticketType);
      return result;
    } catch (error) {
      throw new ErrorModel(500, "Errore nell'aggiunta del tipo di biglietto");
    }
  }

  async updateTicketTypes(routeId: string, ticketTypes: TicketType[]) {
    try {
      const result = await this.routeDao.updateTicketTypes(routeId, ticketTypes);
      return result;
    } catch (error) {
      throw new ErrorModel(500, "Errore nell'aggiornamento dei tipi di biglietti");
    }
  }

  async deleteRoute(routeId: string) {
    try {
      const result = await this.routeDao.deleteRoute(routeId);
      return result;
    } catch (error) {
      throw new ErrorModel(500, "Errore nell'eliminazione della Route");
    }
  }

  async disableRoute(routeId: string, stopId: string) {
    try {
      const result = await this.routeDao.disableStopInRoute(routeId, stopId);
      return result;
    } catch (error) {
      throw new ErrorModel(500, "Errore nella disabilitazione della Route");
    }
  }
}
