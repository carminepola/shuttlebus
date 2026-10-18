import rateLimit from "express-rate-limit";
import type { Request } from "express";

// Rate limiting dedicato ai endpoint di autenticazione (login, registrazione, recupero password).
// Due dimensioni: per-IP e per-account (email). Contano SOLO i tentativi falliti
// (skipSuccessfulRequests), cosi' un login corretto non consuma la quota.

const WINDOW_MS = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);
const IP_MAX = parseInt(process.env.AUTH_RATE_LIMIT_IP_MAX || "50", 10);
const ACCOUNT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_ACCOUNT_MAX || "10", 10);

const baseOptions = {
  windowMs: WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Troppe richieste. Riprova più tardi." },
};

// Limiter per-IP: fa affidamento su req.ip; con "trust proxy" attivo l'IP reale
// (X-Forwarded-For / X-Real-IP) viene considerato SOLO se proviene dal proxy fidato.
export const authIpLimiter = rateLimit({
  ...baseOptions,
  limit: IP_MAX,
  keyGenerator: (req: Request) => req.ip || "unknown",
});

// Limiter per-account: chiave = email (lowercase) nel body della richiesta
export const authAccountLimiter = rateLimit({
  ...baseOptions,
  limit: ACCOUNT_MAX,
  keyGenerator: (req: Request) => {
    const email = req.body?.email;
    if (typeof email === "string" && email.length > 0) {
      return `account:${email.trim().toLowerCase()}`;
    }
    return `no-account:${req.ip || "unknown"}`;
  },
});
