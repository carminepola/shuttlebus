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
        logger.info("Connessione al db mongo");
        this.connectionString = connectionString;
        this.client = new MongoClient(this.connectionString);
        await this.client?.connect();
        logger.info("Connesso al db mongo");
        this.db = await this.client.db();
        return this.db;
      } else {
        logger.error("Nessuna string di connessione");
      }
    } catch (error) {
      logger.error("Impossibile connettersi al db mongo: ", error);
    }
    return null;
  }

  getDb(): Db {
    if (!this.db) {
      throw new Error("Database non connesso");
    }
    return this.db;
  }

  isConnect(): boolean {
    return !!this.db || false;
  }

  async close(): Promise<void> {
    await this.client?.close();
    logger.info("Connessione chiusa");
  }
}
