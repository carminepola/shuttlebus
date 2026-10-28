import Stripe from "stripe";
require("dotenv").config();
class StripeInstance {
  private static stripeInstance: Stripe | null = null; // Inizialmente null

  private constructor() {} // ❌ Impedisce la creazione diretta dell'istanza

  public static getInstance(): Stripe {
    if (!this.stripeInstance) {
      this.stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2026-09-30.endive",
      });
    }
    return this.stripeInstance;
  }
}

export default StripeInstance;
