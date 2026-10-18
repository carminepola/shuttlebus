import express from "express";
import helmet from "helmet";
import cors from "cors";
import api from "./api";
import routeNotFoundMiddleware from "./middlewares/routeNotFoundMiddleware";
import requestMiddleware from "./middlewares/requestMiddleware";
import errorMiddleware from "./middlewares/errorMiddleware";
import tokenRequestMiddleware from "./middlewares/tokenRequestMiddleware";
import versionMiddleware from "./middlewares/versionMiddleware";
import responseMiddleware from "./middlewares/responseMiddleware";
import cookieParser from "cookie-parser";
import { logSendStatusMiddleware } from "./middlewares/sendStatusMiddleware";
import noSqlInjectionMiddleware from "./middlewares/noSqlInjectionMiddleware";
import rateLimitMiddleware from "./middlewares/rateLimitMiddleware";
import stripeWebhookRouter from "./api/stripeWebhook";
import session from "express-session";
import passport from "passport";
import "./passportConfig";
//variabili d'ambiente
require("dotenv").config();
const app = express();
// Fidati del reverse proxy (nginx) per ottenere l'IP reale del client
app.set("trust proxy", 1);
//CORS: usa solo le origini configurate in ALLOWED_ORIGINS
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
if (!allowedOrigins || allowedOrigins.length === 0) {
  console.warn("⚠️ ALLOWED_ORIGINS non configurato. CORS bloccato per tutte le origini.");
}
app.use(cors({ origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : false, credentials: true }));
//Abilita helmet per la sicurezza
app.use(helmet());
//Rate limiting globale: 1000 richieste al minuto per IP (configurabile)
app.use(rateLimitMiddleware);

app.use(
  session({
    secret: process.env.JWT_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 ore
      secure: process.env.NODE_ENV == "PROD" || process.env.NODE_ENV == "TEST" ? true : false,
      sameSite: process.env.SAME_SITE === "strict" || process.env.SAME_SITE == "lax" ? process.env.SAME_SITE : "none",
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());
//Abilita cookie parser per leggere i cookie
app.use(cookieParser());
//Webhook Stripe: montato su /stripe/webhook (prima dei body parser, body RAW)
app.use("/stripe", stripeWebhookRouter);
//Abilita urlencoded per leggere i parametri di query
app.use(express.urlencoded({ extended: true }));
//Abilita json per leggere i parametri di body.
//verify conserva una copia RAW del body: e' necessaria per la verifica della
//firma Stripe anche quando l'endpoint e' raggiunto via /api/stripe/webhook
//(montato DOPO i parser globali).
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = Buffer.from(buf);
    },
  }),
);
app.use(logSendStatusMiddleware);

//Crea il token per la richiesta
app.use(tokenRequestMiddleware);
//Da la versione del server alla risposta
app.use(versionMiddleware);
//Logga la richiesta
app.use(requestMiddleware);
app.use(noSqlInjectionMiddleware);
//Logga la risposta
app.use(responseMiddleware);

//Router dell api
app.use(api);

//Se non trova il path
app.use(routeNotFoundMiddleware);
//Se va in errore
app.use(errorMiddleware);

export default app;
