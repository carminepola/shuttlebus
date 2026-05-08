import rateLimit, { type Request } from "express-rate-limit";

// Rate limiter globale: max 100 richieste ogni 15 minuti per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100,
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
