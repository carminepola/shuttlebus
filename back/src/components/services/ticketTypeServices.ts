import { Db } from 'mongodb';

import TicketTypeDao from '../dao/ticketTypeDao';
import TicketTypeModel from '../../model/ticketTypeModel';
class TicketTypeServices {
  private ticketTypeDao: TicketTypeDao;

  constructor(db: Db) {
    this.ticketTypeDao = new TicketTypeDao(db);
  }

  async createTicketType(obj: any) {
    let ticketTypeData = new TicketTypeModel(obj);
    return this.ticketTypeDao.createTicketType(ticketTypeData);
  }

  async getAllTicketTypes() {
    return this.ticketTypeDao.getAllTicketType();
  }

  async getAllActiveTicketTypes() {
    return this.ticketTypeDao.getAllActiveTicketType();
  }

  async getTicketType(id: string) {
    return this.ticketTypeDao.getTicketType(id);
  }

  async updateTicketType(obj: any) {
    let ticketTypeData = new TicketTypeModel(obj);
    return this.ticketTypeDao.updateTicketType(ticketTypeData);
  }

  async deleteTicketType(id: string) {
    return this.ticketTypeDao.deleteTicketType(id);
  }
}

export default TicketTypeServices;
