import { Db } from 'mongodb';
import BookingDao from '../dao/bookingsDao';
import booking from '../../model/bookFromSiteModel';
import UserServices from './userServices';
import { client } from '../../index';
import { ClientSession } from 'mongodb';
import PaymentsDAO from '../dao/paymentsDao';
import stripeServices from './stripeServices';

class PaymentServices {
  private paymentDao: PaymentsDAO;

  public stripeServices: stripeServices;

  constructor(db: Db) {
    this.paymentDao = new PaymentsDAO(db);
    this.stripeServices = new stripeServices();
  }

  async getPaymentMethod() {
    return this.paymentDao.getPaymentMethod();
  }

  async calculatePayment(ticket: booking, paymentType?: string): Promise<{ type: string; other: any }> {
    try {
      if (paymentType === 'cash') {
        ticket.paymentMethod = [{ type: 'cash', data: null }];
        ticket.other = { type: 'cash' };
        return { type: 'cash', other: { type: 'cash' } };
      }

      let paymentMethods: any = await this.paymentDao.getPaymentMethod();
      switch (paymentMethods.type) {
        case 'stripe':
          let session: any = await this.stripeServices.getPaymentSession(ticket);
          ticket.paymentMethod = paymentMethods.type;
          ticket.other = session;

          return { type: 'stripe', other: session };
      }
    } catch (error) {
      throw error;
    }
    return { type: 'error', other: 'none' };
  }
}

export default PaymentServices;
