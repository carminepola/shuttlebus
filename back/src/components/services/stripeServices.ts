import { env, logger } from "../../index";
import { TicketType } from "../../model/bookFromSiteModel";
import booking from "../../model/bookFromSiteModel";
import StripeInstance from "../../stripe";
class StripeServices {
  private stripe: any;
  constructor() {
    this.stripe = StripeInstance.getInstance();
  }

  async getPaymentSession(ticket: booking) {
    try {
      let ticketData = ticket.date.split("-").reverse().join("/");
      let name = `${ticket.lng == "it" ? ticket.name.it : ticket.name.en} • ${ticket.from.name} (${ticket.from.stopTime}) - ${ticket.to.name} (${ticket.to.stopTime}) • ${ticketData} `;
      let items = ticket.ticketTypes.map((item: TicketType) => {
        return {
          price_data: {
            currency: "eur",
            product_data: {
              name: (ticket.lng == "it" ? item.name.it : item.name.en) + " • " + (ticket.lng == "it" ? item.description.it : item.description.en),
              description: name,
            },
            unit_amount: item.cost * 100,
          },
          quantity: item.count,
        };
      });

      if (ticket.luggage > 0) {
        items.push({
          price_data: {
            currency: "eur",
            product_data: {
              name: ticket.lng == "it" ? "Bagaglio extra" : "Extra luggage",
              description: ticket.lng == "it" ? "Bagaglio aggiuntivo oltre a quello incluso" : "Additional luggage beyond the one included",
            },
            unit_amount: 2 * 100,
          },
          quantity: ticket.luggage,
        });
      }

      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        customer_email: ticket.user.mail,
        line_items: items,
        mode: "payment",
        payment_intent_data: {
          capture_method: "manual", // ⬅️ Questo imposta il pagamento manuale
        },
        success_url: `${env.CLIENT_URL}/payment/stripe/success/${ticket.numberOfTickets}`,
        cancel_url: `${env.CLIENT_URL}/payment/stripe/cancel/${ticket.numberOfTickets}`,
        metadata: {
          route: ` ${ticket.from.name} (${ticket.from.stopTime}) - ${ticket.to.name} (${ticket.to.stopTime}))`, // Es: "Napoli - Amalfi"
          booking_id: ticket.numberOfTickets, // ID della prenotazione
          departure: ticket.date, // Data di partenza
          userId: ticket.user.id, // ID utente
          user: ticket.user.name, // Nome utente
          lng: ticket.lng, // Lingua
          mail: ticket.user.mail, // Mail utente
        },
        expires_at: Math.floor(Date.now() / 1000) + 60 * 30, //30 minuti
      });

      return session;
    } catch (error) {
      logger.error("Impossibile creare la sessione di pagamento", error);

      throw new Error("str_error_payment");
    }
  }

  public async deletePaymentSession(booking_id: string) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(booking_id);
      if (session && session.status !== "expired") {
        this.stripe.checkout.sessions.expire(booking_id);
      }
    } catch (error) {
      throw new Error("str_error_payment");
    }
  }
  public async getPayouts(limit: number = 10) {
    try {
      const payouts = await this.stripe.payouts.list({ limit });
      return payouts.data.map((p: any) => ({
        id: p.id,
        amount: (p.amount / 100).toFixed(2), // da centesimi a €
        currency: p.currency.toUpperCase(),
        status: p.status,
        arrival_date: new Date(p.arrival_date * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }),
      }));
    } catch (err) {
      logger.error("Errore nel recupero payouts", err);
      throw err;
    }
  }

  public async getBalance() {
    try {
      const balance = await this.stripe.balance.retrieve();
      return {
        available: balance.available.map((b: any) => ({
          amount: +(b.amount / 100).toFixed(2),
          currency: b.currency.toUpperCase(),
        })),
        pending: balance.pending.map((b: any) => ({
          amount: +(b.amount / 100).toFixed(2),
          currency: b.currency.toUpperCase(),
        })),
      };
    } catch (err) {
      logger.error("Errore nel recupero balance", err);
      throw err;
    }
  }
  public async getAccountSchedule() {
    try {
      const account = await this.stripe.accounts.retrieve();
      const interval = account.settings?.payouts?.schedule?.interval;
      let nextPayoutDate: Date | null = null;

      if (interval === "weekly" && account.settings?.payouts?.schedule?.weekly_anchor) {
        // Find next weekly payout date
        const anchorDay = account.settings.payouts.schedule.weekly_anchor; // e.g., "friday"
        const daysOfWeek: Record<string, number> = {
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
          sunday: 0,
        };
        const today = new Date();
        const todayDay = today.getDay();
        const payoutDay = daysOfWeek[anchorDay.toLowerCase()];
        let daysUntilPayout = payoutDay - todayDay;
        if (daysUntilPayout <= 0) daysUntilPayout += 7;
        nextPayoutDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilPayout);
      } else if (interval === "monthly" && account.settings?.payouts?.schedule?.monthly_anchor) {
        // Find next monthly payout date
        const anchorDate = account.settings.payouts.schedule.monthly_anchor; // e.g., 15
        const today = new Date();
        let payoutMonth = today.getMonth();
        let payoutYear = today.getFullYear();
        if (today.getDate() >= anchorDate) {
          payoutMonth += 1;
          if (payoutMonth > 11) {
            payoutMonth = 0;
            payoutYear += 1;
          }
        }
        nextPayoutDate = new Date(payoutYear, payoutMonth, anchorDate);
      }

      return nextPayoutDate
        ? {
            interval,
            next_payout: {
              day: nextPayoutDate.getDate(),
              month: nextPayoutDate.getMonth() + 1,
              year: nextPayoutDate.getFullYear(),
              iso: `${nextPayoutDate.getDate().toString().padStart(2, "0")}/${(nextPayoutDate.getMonth() + 1).toString().padStart(2, "0")}/${nextPayoutDate.getFullYear()}`,
            },
          }
        : { interval, next_payout: null };
    } catch (err) {
      logger.error("Errore nel recupero account schedule", err);
      throw err;
    }
  }
}

export default StripeServices;
