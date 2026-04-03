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
        await this.stripe.checkout.sessions.expire(booking_id);
      }
    } catch (error) {
      logger.error("Errore scadenza sessione Stripe", error);
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

  public async getMonthlyRevenue() {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      const [currentCharges, lastMonthCharges, currentRefunds, lastMonthRefunds] = await Promise.all([
        this.stripe.charges.list({
          created: { gte: Math.floor(startOfMonth.getTime() / 1000) },
          limit: 100,
        }),
        this.stripe.charges.list({
          created: { gte: Math.floor(startOfLastMonth.getTime() / 1000), lt: Math.floor(endOfLastMonth.getTime() / 1000) + 1 },
          limit: 100,
        }),
        this.stripe.refunds.list({
          created: { gte: Math.floor(startOfMonth.getTime() / 1000) },
          limit: 100,
        }),
        this.stripe.refunds.list({
          created: { gte: Math.floor(startOfLastMonth.getTime() / 1000), lt: Math.floor(endOfLastMonth.getTime() / 1000) + 1 },
          limit: 100,
        }),
      ]);

      const sumCharges = (charges: any[]) =>
        charges.filter((c: any) => c.status === "succeeded").reduce((sum: number, c: any) => sum + c.amount, 0);

      const sumRefunds = (refunds: any[]) =>
        refunds.filter((r: any) => r.status === "succeeded").reduce((sum: number, r: any) => sum + r.amount, 0);

      const currentRevenue = sumCharges(currentCharges.data);
      const lastMonthRevenue = sumCharges(lastMonthCharges.data);
      const currentRefundTotal = sumRefunds(currentRefunds.data);
      const lastMonthRefundTotal = sumRefunds(lastMonthRefunds.data);
      const currentNet = currentRevenue - currentRefundTotal;
      const lastMonthNet = lastMonthRevenue - lastMonthRefundTotal;

      const revenueChange = lastMonthRevenue > 0 ? ((currentRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;
      const refundChange = lastMonthRefundTotal > 0 ? ((currentRefundTotal - lastMonthRefundTotal) / lastMonthRefundTotal * 100) : 0;

      const last6Months: { month: string; revenue: number; refunds: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = Math.floor(d.getTime() / 1000);
        const monthEnd = Math.floor(new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime() / 1000);

        const [mCharges, mRefunds] = await Promise.all([
          this.stripe.charges.list({ created: { gte: monthStart, lt: monthEnd + 1 }, limit: 100 }),
          this.stripe.refunds.list({ created: { gte: monthStart, lt: monthEnd + 1 }, limit: 100 }),
        ]);

        last6Months.push({
          month: d.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
          revenue: sumCharges(mCharges.data) / 100,
          refunds: sumRefunds(mRefunds.data) / 100,
        });
      }

      return {
        currentMonth: {
          revenue: currentRevenue / 100,
          refunds: currentRefundTotal / 100,
          net: currentNet / 100,
        },
        lastMonth: {
          revenue: lastMonthRevenue / 100,
          refunds: lastMonthRefundTotal / 100,
          net: lastMonthNet / 100,
        },
        revenueChange: +revenueChange.toFixed(1),
        refundChange: +refundChange.toFixed(1),
        last6Months,
      };
    } catch (err) {
      logger.error("Errore nel recupero monthly revenue", err);
      throw err;
    }
  }
}

export default StripeServices;
