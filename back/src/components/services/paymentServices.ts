import { Db } from "mongodb";
import BookingDao from "../dao/bookingsDao";
import booking from "../../model/bookFromSiteModel";
import UserServices from "./userServices";
import { client } from "../../index";
import { ClientSession } from "mongodb";
import PaymentsDAO from "../dao/paymentsDao";
import stripeServices from "./stripeServices";
import TicketTypeServices from "./ticketTypeServices";
import RoutesServices from "./routesServices";
import { resolveFarePrice, resolveLuggagePrice } from "../../utils/fares";
import { isTicketTypeValidOn } from "../../utils/ticketDays";
import StripeCustomersDao from "../dao/stripeCustomersDao";
import { logger } from "../../index";
import { LUGGAGE_PRICE_KEY } from "../../constants";

class PaymentServices {
  private paymentDao: PaymentsDAO;
  private ticketTypeServices: TicketTypeServices;
  private routesServices: RoutesServices;
  private stripeCustomersDao: StripeCustomersDao;
  public stripeServices: stripeServices;

  constructor(db: Db) {
    this.paymentDao = new PaymentsDAO(db);
    this.ticketTypeServices = new TicketTypeServices(db);
    this.routesServices = new RoutesServices(db);
    this.stripeCustomersDao = new StripeCustomersDao(db);
    this.stripeServices = new stripeServices();
  }

  async getPaymentMethod() {
    return await this.paymentDao.getPaymentMethod();
  }

  /**
   * P-01: per ogni tratta una mappa id -> costo costruita SOLO da DB (ticket types
   * attivi + tariffa from -> to della route). Mai dal payload client: un costo
   * mancante lato DB fa fallire la sessione.
   */
  private async getPricesFromDb(tickets: booking[]): Promise<Record<string, number>[]> {
    const types = (await this.ticketTypeServices.getAllActiveTicketTypes()) || [];
    const result: Record<string, number>[] = [];
    for (const leg of tickets) {
      const route: any = await this.routesServices.getRouteById(leg.routeId);
      const map: Record<string, number> = {};
      for (const t of types) {
        // tipo non valido nel giorno della tratta: assente dalla mappa -> sessione bloccata
        if (!isTicketTypeValidOn(t, leg.date)) continue;
        map[t.id] = resolveFarePrice(route, leg.from?.id, leg.to?.id, t);
      }
      // prezzo del bagaglio della corsa (chiave riservata, non e' un id di ticket type)
      map[LUGGAGE_PRICE_KEY] = resolveLuggagePrice(route?.schedules?.find((s: any) => s.id === leg.scheduleId));
      result.push(map);
    }
    return result;
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

  /** Con andata e ritorno `tickets` ha due prenotazioni, pagate con un'unica sessione. */
  /** Cancella il customer Stripe dell'utente: con lui spariscono le carte salvate. */
  async deleteCustomer(userId: string): Promise<void> {
    const saved = await this.stripeCustomersDao.getByUserId(userId);
    if (!saved) return;
    if (await this.stripeServices.customerExists(saved.customerId)) {
      await this.stripeServices.deleteCustomer(saved.customerId);
    }
    await this.stripeCustomersDao.deleteByUserId(userId);
  }

  async calculatePayment(tickets: booking[], paymentType?: string): Promise<{ type: string; other: any }> {
    try {
      if (paymentType === "cash") {
        for (const ticket of tickets) {
          ticket.paymentMethod = [{ type: "cash", data: null }];
          ticket.other = { type: "cash" };
        }
        return { type: "cash", other: { type: "cash" } };
      }

      let paymentMethods: any = await this.paymentDao.getPaymentMethod();
      switch (paymentMethods.type) {
        case "stripe":
          let dbPrices = await this.getPricesFromDb(tickets);
          let customerId = await this.getCheckoutCustomerId(tickets[0]);
          let session: any = await this.stripeServices.getPaymentSession(tickets, dbPrices, customerId);
          for (const ticket of tickets) {
            ticket.paymentMethod = paymentMethods.type;
            ticket.other = session;
          }

          return { type: "stripe", other: session };
      }
    } catch (error) {
      throw error;
    }
    return { type: "error", other: "none" };
  }
}

export default PaymentServices;
