import Mongo from "./infrastructure/mongo";
import RestServer from "./infrastructure/restServer";
import { SeqTransport } from "@datalust/winston-seq";
import { Console } from "console";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
const env = process.env;
const appName = env.APP_NAME || "No name";
import winston from "winston";
let transportsType = [];
console.log(`${new Date().toISOString().replace("T", " ").split(".")[0]} ${`\x1b[32m` + "info" + `\x1b[0m`}: Avvio dell'app\x1b[0m`);
const consoleTransport = new winston.transports.Console({
  level: env.LOGLEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    winston.format.errors({ stack: true }),
    winston.format.metadata({ fillExcept: ["message", "level", "timestamp"] }),
    winston.format.printf((info: any) => {
      let out = `${info.timestamp} ${info.level}: ${info.message}`;
      if (info.metadata && info.metadata.error) {
        out += `\n${JSON.stringify(info.metadata.error)}`;
        if (info.metadata.error.stack) {
          out += `\n ${info.metadata.error.stack}`;
        }
      }
      return out;
    })
  ),
});
transportsType.push(consoleTransport);

if (env.LOG_URL && env.LOG_API_KEY) {
  transportsType.push(
    new SeqTransport({
      serverUrl: env.LOG_URL,
      apiKey: env.LOG_API_KEY,
      onError: (e: any) => {
        console.error(JSON.stringify(e));
      },
      handleExceptions: true,
      handleRejections: true,
    })
  );
} else {
  transportsType.push(
    new winston.transports.File({
      filename: "app.log",
      level: "error", // Solo errori
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    })
  );
}

let logger = winston.createLogger({
  level: env.LOGLEVEL || "debug",
  format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.json()),
  defaultMeta: {
    application: appName,
    env: env.NODE_ENV,
  },
  transports: transportsType,
});

logger.info("Logger inizializzato");
if (env.LOG_URL && env.LOG_API_KEY) {
  logger.info("Log configurato su seq: " + env.LOG_URL);
} else {
  logger.info("Log configurato su file");
}
let mailConfig: any;
if (process.env.EMAIL_SMTP && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  mailConfig = {
    host: process.env.EMAIL_SMTP,
    port: process.env.EMAIL_PORT || 465,
    secure: process.env.EMAIL_SECURE || true,
    logger: env.EMAIL_LOG ? env.EMAIL_LOG.toLowerCase() == "true" : true,
    debug: env.LOGLEVEL ? env.LOGLEVEL : "debug",
    auth: {
      user: process.env.EMAIL_USER, // Inserisci qui il tuo indirizzo email
      pass: process.env.EMAIL_PASS, // Inserisci qui la tua password
    },
  };
  logger.info("Configurazione email presente");
} else {
  logger.warn("Configurazione email mancante non sarà possibile inviare email da quest'applicazione");
  mailConfig = undefined;
}

let db: any;
let databaseInstance: any;
let dbStarted = false;
const restServer = new RestServer(parseInt(env.PORT || "1800"));
//Db default

const startServer = async () => {
  try {
    switch (env.DB_TYPE) {
      case "MONGODB":
        if (env.CONNECTION_STRING) {
          databaseInstance = new Mongo();
          db = await databaseInstance.init(env.CONNECTION_STRING);
          if (db) {
            dbStarted = true;
          }
        }

        break;

      default:
        logger.warn("App senza db");
        break;
    }
    if (!dbStarted && env.DB_DEPENDECIES && env.DB_DEPENDECIES.toLocaleLowerCase() == "true") {
      logger.error(`Impossibile avviare l'app`);
      return;
    }
    logger.info("Avvio del rest server");
    restServer.run();
  } catch (error) {
    logger.error(`Error connecting to the database`, error);
  }
};

startServer();

//Esporto il db per renderlo accessibile all'app
export { db, restServer, logger, env, mailConfig };
