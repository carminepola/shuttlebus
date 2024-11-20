// File: db.ts
import { MongoClient, Db } from "mongodb";
import { logger } from "..";
export default class Mongo {
  private connectionString: string | undefined;

  private client: MongoClient | undefined;

  private db: Db | undefined;

  constructor() {}

  async init(connectionString: string) {
    try {
      if (connectionString) {
        this.connectionString = connectionString;
        this.client = new MongoClient(this.connectionString);
        this.db = await this.client.db(); // Inizializza la proprietà db nel costruttore
        return this.db;
      } else {
        logger.error("Nessuna string di connessione");
      }
    } catch (error) {
      logger.error("Impossibile connettersi al db mongo: ", error);
    }
  }

  async run(): Promise<MongoClient> {
    return new Promise(async (resolve, rejected) => {
      try {
        if (this.connectionString) {
          logger.info("Connessione al db mongo");
          await this.client?.connect();
          if (this.client) {
            logger.info("Connesso al db mongo");
            resolve(this.client);
          } else {
            logger.info("Non connesso al db mongo");
            rejected(undefined);
          }
        } else {
          logger.warn("Nessuna stringa connessione mongo");
        }
      } catch (error) {
        throw error;
      }
    });
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error("Database non connesso");
    }
    return this.db
  }

  isConnect(): boolean {
    return !!this.db || false;
  }

  async close(): Promise<void> {
    await this.client?.close();
    logger.info("Connessione chiusa");
  }
}
