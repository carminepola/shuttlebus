import Stripe from "stripe";
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
      let name = `${ticket.lng == "it" ? ticket.name.it : ticket.name.en} • ${ticket.from.name} (${ticket.from.stopTime}) - ${ticket.to.name} (${ticket.to.stopTime}))`;
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
}

export default StripeServices;
