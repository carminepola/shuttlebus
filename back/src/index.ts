import Mongo from "./infrastructure/mongo";
import Postgres from "./infrastructure/postegreSql";
import RestServer from "./infrastructure/restServer";
import { SeqTransport } from "@datalust/winston-seq";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
const env = process.env;
const appName = env.hostname || "Microservices no name";
import winston from "winston";
let transportsType = [];
if (env.LOG_URL && env.LOG_API_KEY) {
  transportsType = [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new SeqTransport({
      serverUrl: env.LOG_URL,
      apiKey: env.LOG_API_KEY,
      onError: (e: any) => {
        console.error(JSON.stringify(e));
      },
      handleExceptions: true,
      handleRejections: true,
    }),
  ];
} else {
  transportsType = [
    new winston.transports.Console({
      level: env.LOGLEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.colorize(),
        winston.format.errors({ stack: true }),
        winston.format.metadata({ fillExcept: ["message", "level", "timestamp"] }),
        winston.format.printf((info:any) => {
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
    }),

    new winston.transports.File({
      filename: "app.log",
      level: "error", // Solo errori
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
  ];
}

let logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(winston.format.errors({ stack: true }), winston.format.json()),
  defaultMeta: {
    application: appName,
  },
  transports: transportsType,
});

//Variabili env
logger.level = env.LOG_LEVEL || "debug";
const port = env.PORT || "1800";
const dbDependencies = env.DB_DEPENDECIES || false;
const connectionString = env.CONNECTION_STRING; // EXEMPLE "mongodb://localhost:27017"
const postgresURI = env.POSTGRES_CONNECTION; // EXEMPLE "postgresql://username:password@localhost:5432/nomedeldatabase"
let db: any;
let dbStarted = false;
const restServer = new RestServer(parseInt(port));
//Db default

const startServer = async () => {
  try {
    switch (env.DB_TYPE) {

      case "MONGODB":
        if(connectionString){
          let mongoDb = new Mongo();
          await mongoDb.init(connectionString);
          if (mongoDb.isConnect()) {
            dbStarted = true;
            db=mongoDb.db
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
    } else if (dbStarted) {
      logger.info(`DB Connesso`);
    }
    restServer.run();
  } catch (error) {
    logger.error(`Error connecting to the database`, error);
  }
};

// Autoesegui la funzione startServer
logger.info("Avvio dell'app");
startServer();

//Esporto il db per renderlo accessibile all'app
export { db, restServer, logger, env };
