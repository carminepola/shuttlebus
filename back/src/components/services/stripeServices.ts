import { env, logger } from "../../index";
import { TicketType } from "../../model/bookFromSiteModel";
import booking from "../../model/bookFromSiteModel";
import StripeInstance from "../../stripe";

type SupportedLng = "it" | "en" | "fr" | "de" | "es" | "jp";

function getLocalizedName(obj: any, lng: string): string {
  const supported = lng as SupportedLng;
  return (obj as any)?.[supported] ?? obj?.en ?? obj?.it ?? "";
}

const STRIPE_LABELS: Record<SupportedLng, Record<string, string>> = {
  it: { extraLuggage: "Bagaglio extra", extraLuggageDesc: "Bagaglio aggiuntivo oltre a quello incluso" },
  en: { extraLuggage: "Extra luggage", extraLuggageDesc: "Additional luggage beyond the one included" },
  fr: { extraLuggage: "Bagage supplémentaire", extraLuggageDesc: "Bagage supplémentaire au-delà de celui inclus" },
  de: { extraLuggage: "Zusätzliches Gepäck", extraLuggageDesc: "Zusätzliches Gepäck über das Inklusive hinaus" },
  es: { extraLuggage: "Equipaje adicional", extraLuggageDesc: "Equipaje adicional más allá del incluido" },
  jp: { extraLuggage: "追加荷物", extraLuggageDesc: "含まれる荷物を超える追加荷物" },
};

function getStripeLabel(key: string, lng: string): string {
  const supported = lng as SupportedLng;
  return STRIPE_LABELS[supported]?.[key] ?? STRIPE_LABELS.it[key];
}

class StripeServices {
  private stripe: any;
  constructor() {
    this.stripe = StripeInstance.getInstance();
  }

  async getPaymentSession(ticket: booking) {
    try {
      let ticketData = ticket.date.split("-").reverse().join("/");
      let name = `${getLocalizedName(ticket.name, ticket.lng)} • ${ticket.from.name} (${ticket.from.stopTime}) - ${ticket.to.name} (${ticket.to.stopTime}) • ${ticketData} `;
      let items = ticket.ticketTypes.map((item: TicketType) => {
        return {
          price_data: {
            currency: "eur",
            product_data: {
              name: getLocalizedName(item.name, ticket.lng) + " • " + getLocalizedName(item.description, ticket.lng),
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
              name: getStripeLabel("extraLuggage", ticket.lng),
              description: getStripeLabel("extraLuggageDesc", ticket.lng),
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
          capture_method: "manual",
          metadata: {
            booking_id: ticket.numberOfTickets,
            departure: ticket.date,
            route: `${ticket.from.name} (${ticket.from.stopTime}) - ${ticket.to.name} (${ticket.to.stopTime})`,
            user: ticket.user.name,
            mail: ticket.user.mail,
          },
          description: `Ticket ${ticket.numberOfTickets} - ${ticket.from.name} → ${ticket.to.name} (${ticket.date})`,
        },
        success_url: `${env.CLIENT_URL}/payment/stripe/success/${ticket.numberOfTickets}`,
        cancel_url: `${env.CLIENT_URL}/payment/stripe/cancel/${ticket.numberOfTickets}`,
        metadata: {
          route: `${ticket.from.name} (${ticket.from.stopTime}) - ${ticket.to.name} (${ticket.to.stopTime})`,
          booking_id: ticket.numberOfTickets,
          departure: ticket.date,
          userId: ticket.user.id,
          user: ticket.user.name,
          lng: ticket.lng,
          mail: ticket.user.mail,
        },
        expires_at: Math.floor(Date.now() / 1000) + 60 * 30,
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
        amount: (p.amount / 100).toFixed(2),
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
        const anchorDay = account.settings.payouts.schedule.weekly_anchor;
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
        const anchorDate = account.settings.payouts.schedule.monthly_anchor;
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

  public async getRefunds(limit: number = 20) {
    try {
      const refunds = await this.stripe.refunds.list({ limit, expand: ["data.charge"] });
      return refunds.data.map((r: any) => ({
        id: r.id,
        amount: (r.amount / 100).toFixed(2),
        currency: r.currency.toUpperCase(),
        status: r.status,
        reason: r.reason || r.failure_reason || "N/D",
        created: new Date(r.created * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        chargeId: r.charge?.id || "",
      }));
    } catch (err) {
      logger.error("Errore nel recupero refunds", err);
      throw err;
    }
  }

  public async getDisputes(limit: number = 20) {
    try {
      const disputes = await this.stripe.disputes.list({ limit, expand: ["data.charge"] });
      return disputes.data.map((d: any) => ({
        id: d.id,
        amount: (d.amount / 100).toFixed(2),
        currency: d.currency.toUpperCase(),
        status: d.status,
        reason: d.reason || "N/D",
        created: new Date(d.created * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        chargeId: d.charge?.id || "",
        paymentIntentId: d.payment_intent || "",
        evidenceDetails: d.evidence_details ? {
          dueBy: d.evidence_details.due_by ? new Date(d.evidence_details.due_by * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }) : null,
          hasEvidence: !!d.evidence_details.has_evidence,
          submissionCount: d.evidence_details.submission_count || 0,
        } : null,
      }));
    } catch (err) {
      logger.error("Errore nel recupero disputes", err);
      throw err;
    }
  }

  public async closeDispute(disputeId: string) {
    try {
      return await this.stripe.disputes.close(disputeId);
    } catch (err) {
      logger.error("Errore nella chiusura della disputa", err);
      throw err;
    }
  }

  public async getTransactionsByEmail(email: string, limit: number = 20) {
    try {
      const [paymentIntents, charges] = await Promise.all([
        this.stripe.paymentIntents.search({
          query: `metadata['mail']:'${email}'`,
          limit,
        }),
        this.stripe.charges.search({
          query: `metadata['mail']:'${email}'`,
          limit,
        }),
      ]);

      const piMap = new Map<string, any>();
      for (const pi of paymentIntents.data) {
        piMap.set(pi.id, {
          id: pi.id,
          amount: +(pi.amount / 100).toFixed(2),
          currency: pi.currency.toUpperCase(),
          status: pi.status,
          created: new Date(pi.created * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          description: pi.description || "",
          metadata: pi.metadata || {},
          lastPaymentError: pi.last_payment_error
            ? {
                code: pi.last_payment_error.code || "",
                message: pi.last_payment_error.message || "",
                type: pi.last_payment_error.type || "",
                declineCode: pi.last_payment_error.decline_code || "",
              }
            : null,
          paymentMethodTypes: pi.payment_method_types || [],
        });
      }

      const chargeList = charges.data.map((c: any) => ({
        id: c.id,
        amount: +(c.amount / 100).toFixed(2),
        currency: c.currency.toUpperCase(),
        status: c.status,
        created: new Date(c.created * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        description: c.description || "",
        metadata: c.metadata || {},
        paymentIntentId: c.payment_intent || "",
        failureCode: c.failure_code || "",
        failureMessage: c.failure_message || "",
        outcome: c.outcome
          ? {
              type: c.outcome.type || "",
              riskLevel: c.outcome.risk_level || "",
              riskScore: c.outcome.risk_score || 0,
              sellerMessage: c.outcome.seller_message || "",
            }
          : null,
        refunded: c.refunded || false,
        amountRefunded: +(c.amount_refunded / 100).toFixed(2),
      }));

      return {
        paymentIntents: Array.from(piMap.values()),
        charges: chargeList,
      };
    } catch (err) {
      logger.error("Errore nel recupero transazioni per email", err);
      throw err;
    }
  }

  public async getTransactionsByPaymentIntentIds(bookings: any[]) {
    try {
      if (bookings.length === 0) return [];

      const piMap = new Map<string, any>();
      for (const b of bookings) {
        const piId = b.paymentIntentId || b.other?.payment_intent;
        if (piId && !piMap.has(piId)) piMap.set(piId, b);
      }

      if (piMap.size === 0) return [];

      const results = await Promise.allSettled(
        Array.from(piMap.keys()).map((id) => this.stripe.paymentIntents.retrieve(id, { expand: ["latest_charge"] }))
      );

      return results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map((r) => {
          const pi = r.value;
          const booking = piMap.get(pi.id);
          const charge = pi.latest_charge;
          return {
            id: pi.id,
            amount: +(pi.amount / 100).toFixed(2),
            currency: pi.currency.toUpperCase(),
            status: pi.status,
            created: new Date(pi.created * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
            description: pi.description || "",
            metadata: { ...pi.metadata, booking_status: booking?.status },
            amountRefunded: charge ? +(charge.amount_refunded / 100).toFixed(2) : 0,
            refunded: charge ? charge.refunded : false,
            failureMessage: pi.last_payment_error?.message || null,
          };
        });
    } catch (err) {
      logger.error("Errore nel recupero transazioni per payment intent ids", err);
      throw err;
    }
  }

  public async getAllPaymentIntents(options: { limit?: number; starting_after?: string; status?: string } = {}) {
    try {
      const params: any = { limit: options.limit || 20, expand: ["data.latest_charge"] };
      if (options.starting_after) params.starting_after = options.starting_after;
      if (options.status) params.status = options.status;

      const paymentIntents = await this.stripe.paymentIntents.list(params);

      return {
        data: paymentIntents.data.map((pi: any) => {
          const charge = pi.latest_charge;
          return {
            id: pi.id,
            amount: +(pi.amount / 100).toFixed(2),
            currency: pi.currency.toUpperCase(),
            status: pi.status,
            created: new Date(pi.created * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
            description: pi.description || "",
            metadata: pi.metadata || {},
            customerEmail: pi.metadata?.mail || pi.receipt_email || "",
            customerName: pi.metadata?.user || "",
            amountRefunded: charge ? +(charge.amount_refunded / 100).toFixed(2) : 0,
            refunded: charge ? charge.refunded : false,
            failureMessage: pi.last_payment_error?.message || null,
            paymentMethodTypes: pi.payment_method_types || [],
          };
        }),
        hasMore: paymentIntents.has_more,
      };
    } catch (err) {
      logger.error("Errore nel recupero payment intents", err);
      throw err;
    }
  }

  public async getPaymentIntentDetail(id: string) {
    try {
      const pi = await this.stripe.paymentIntents.retrieve(id, {
        expand: ["latest_charge", "latest_charge.refunds"],
      });
      const charge = pi.latest_charge;
      return {
        id: pi.id,
        amount: +(pi.amount / 100).toFixed(2),
        currency: pi.currency.toUpperCase(),
        status: pi.status,
        created: new Date(pi.created * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        description: pi.description || "",
        metadata: pi.metadata || {},
        customerEmail: pi.metadata?.mail || pi.receipt_email || "",
        customerName: pi.metadata?.user || "",
        amountRefunded: charge ? +(charge.amount_refunded / 100).toFixed(2) : 0,
        refunded: charge ? charge.refunded : false,
        failureMessage: pi.last_payment_error?.message || null,
        failureCode: pi.last_payment_error?.decline_code || null,
        paymentMethodTypes: pi.payment_method_types || [],
        refunds: charge?.refunds?.data?.map((r: any) => ({
          id: r.id,
          amount: +(r.amount / 100).toFixed(2),
          status: r.status,
          reason: r.reason || "",
          created: new Date(r.created * 1000).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
        })) || [],
      };
    } catch (err) {
      logger.error("Errore nel recupero dettaglio payment intent", err);
      throw err;
    }
  }
}

export default StripeServices;
