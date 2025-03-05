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
import session from "express-session";
import passport from "passport";
//variabili d'ambiente
require("dotenv").config();
const app = express();
//Abilita cors per tutte le origini
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(",") || "*", credentials: true }));
//Abilita helmet per la sicurezza
app.use(helmet());

app.use(
  session({
    secret: process.env.JWT_SECRET || "",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === "PROD" ? true : false }, // Se usi HTTPS, metti true
  })
);

app.use(passport.initialize());
app.use(passport.session());
//Abilita cookie parser per leggere i cookie
app.use(cookieParser());
//Abilita urlencoded per leggere i parametri di query
app.use(express.urlencoded({ extended: true }));
//Abilita json per leggere i parametri di body
app.use(express.json());
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
