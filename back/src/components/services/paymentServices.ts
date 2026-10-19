import { Db } from "mongodb";
import BookingDao from "../dao/bookingsDao";
import booking from "../../model/bookFromSiteModel";
import UserServices from "./userServices";
import { client } from "../../index";
import { ClientSession } from "mongodb";
import PaymentsDAO from "../dao/paymentsDao";
import stripeServices from "./stripeServices";
import TicketTypeServices from "./ticketTypeServices";

class PaymentServices {
  private paymentDao: PaymentsDAO;
  private ticketTypeServices: TicketTypeServices;
  public stripeServices: stripeServices;

  constructor(db: Db) {
    this.paymentDao = new PaymentsDAO(db);
    this.ticketTypeServices = new TicketTypeServices(db);
    this.stripeServices = new stripeServices();
  }

  async getPaymentMethod() {
    return await this.paymentDao.getPaymentMethod();
  }

  /**
   * P-01: mappa id -> costo costruita SOLO dai ticket types attivi su DB.
   * Mai dal payload client: un costo mancante lato DB fa fallire la sessione.
   */
  private async getPricesFromDb(): Promise<Record<string, number>> {
    const types = (await this.ticketTypeServices.getAllActiveTicketTypes()) || [];
    const map: Record<string, number> = {};
    for (const t of types) {
      map[t.id] = t.cost;
    }
    return map;
  }

  async calculatePayment(ticket: booking, paymentType?: string): Promise<{ type: string; other: any }> {
    try {
      if (paymentType === "cash") {
        ticket.paymentMethod = [{ type: "cash", data: null }];
        ticket.other = { type: "cash" };
        return { type: "cash", other: { type: "cash" } };
      }

      let paymentMethods: any = await this.paymentDao.getPaymentMethod();
      switch (paymentMethods.type) {
        case "stripe":
          let dbPrices = await this.getPricesFromDb();
          let session: any = await this.stripeServices.getPaymentSession(ticket, dbPrices);
          ticket.paymentMethod = paymentMethods.type;
          ticket.other = session;

          return { type: "stripe", other: session };
      }
    } catch (error) {
      throw error;
    }
    return { type: "error", other: "none" };
  }
}

export default PaymentServices;
