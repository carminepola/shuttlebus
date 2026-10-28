import { Db } from "mongodb";
import BookingDao from "../dao/bookingsDao";
import booking from "../../model/bookFromSiteModel";
import UserServices from "./userServices";
import { client } from "../../index";
import { ClientSession } from "mongodb";
import PaymentsDAO from "../dao/paymentsDao";
import stripeServices from "./stripeServices";
import TicketTypeServices from "./ticketTypeServices";
import StripeCustomersDao from "../dao/stripeCustomersDao";
import { logger } from "../../index";

class PaymentServices {
  private paymentDao: PaymentsDAO;
  private ticketTypeServices: TicketTypeServices;
  private stripeCustomersDao: StripeCustomersDao;
  public stripeServices: stripeServices;

  constructor(db: Db) {
    this.paymentDao = new PaymentsDAO(db);
    this.ticketTypeServices = new TicketTypeServices(db);
    this.stripeCustomersDao = new StripeCustomersDao(db);
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

  /**
   * Customer Stripe dell'utente, creato al primo checkout. Se Stripe non risponde
   * il pagamento prosegue senza carte salvate invece di fallire.
   */
  private async getCheckoutCustomerId(ticket: booking): Promise<string | undefined> {
    try {
      return await this.getCustomerId(ticket.userId, { email: ticket.user.mail, name: ticket.user.name });
    } catch (error) {
      logger.error("Customer Stripe non disponibile, checkout senza carte salvate", error);
      return undefined;
    }
  }

  /** Senza `create` restituisce undefined se l'utente non ha (piu') un customer. */
  private async getCustomerId(userId: string, create?: { email: string; name?: string }): Promise<string | undefined> {
    const saved = await this.stripeCustomersDao.getByUserId(userId);
    if (saved && (await this.stripeServices.customerExists(saved.customerId))) {
      return saved.customerId;
    }
    if (!create) return undefined;

    const customerId = await this.stripeServices.createCustomer(String(userId), create.email, create.name);
    if (saved) {
      await this.stripeCustomersDao.replace(userId, customerId);
      return customerId;
    }
    const winner = await this.stripeCustomersDao.insertIfMissing(userId, customerId);
    if (winner !== customerId) {
      // checkout concorrente: il customer appena creato resterebbe orfano
      await this.stripeServices.deleteCustomer(customerId).catch(() => undefined);
    }
    return winner;
  }

  async listSavedCards(userId: string) {
    const customerId = await this.getCustomerId(userId);
    return customerId ? await this.stripeServices.listSavedCards(customerId) : [];
  }

  async removeSavedCard(userId: string, paymentMethodId: string): Promise<boolean> {
    const customerId = await this.getCustomerId(userId);
    return customerId ? await this.stripeServices.detachCard(customerId, paymentMethodId) : false;
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
          let customerId = await this.getCheckoutCustomerId(ticket);
          let session: any = await this.stripeServices.getPaymentSession(ticket, dbPrices, customerId);
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
