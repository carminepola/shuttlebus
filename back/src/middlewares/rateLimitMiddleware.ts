import rateLimit from "express-rate-limit";
import type { Request } from "express";

// Rate limiter globale: configurabile tramite variabili d'ambiente
// Default: 1000 richieste al minuto per IP
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "1000", 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(60 * 1000), 10);

const globalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true, // Ritorna info nei header `RateLimit-*`
  legacyHeaders: false, // Disabilita `X-RateLimit-*`
  message: {
    error: "Troppe richieste. Riprova tra qualche minuto.",
  },
  keyGenerator: (req: Request) => {
    // Supporta proxy (x-forwarded-for, x-real-ip)
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    if (req.headers["x-real-ip"]) {
      return req.headers["x-real-ip"] as string;
    }
    return req.ip || "unknown";
  },
});

export default globalLimiter;
