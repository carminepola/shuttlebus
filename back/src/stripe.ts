import Stripe from "stripe";
import { env } from "./index";

class StripeInstance {
  private static stripeInstance: Stripe | null = null; // Inizialmente null

  private constructor() {} // ❌ Impedisce la creazione diretta dell'istanza

  public static getInstance(): Stripe {
    if (!this.stripeInstance) {
      this.stripeInstance = new Stripe(env.STRIPE_SECRET_KEY!, {
        apiVersion: "2025-02-24.acacia",
      });
    }
    return this.stripeInstance;
  }
}

export default StripeInstance;
