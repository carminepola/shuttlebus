import { Pool } from 'pg';
import { logger } from '..';
export default class Postgres {
  private connectionString: string | undefined;

  private client: Pool | undefined;


  constructor() {
   
  }
  async init(connectionString: string){
    this.connectionString = connectionString;
  
  }

  async run(): Promise<Pool> {
    return new Promise(async (resolve, reject) => {
      try {
        this.client = new Pool({
          connectionString: this.connectionString,
        });

        await this.client.connect();
        logger.info('Connesso al db PostgreSQL');
        resolve(this.client);
      } catch (error) {
        logger.error('Errore connessione al database PostgreSQL:', error);
        reject(error);
      
      }
    });
  }

  async getDb(): Promise<Pool> {
    if (!this.client) {
      throw new Error('Database non connesso');
    }
    return this.client;
  }

  isConnect(): boolean {
    return !!this.client;
  }
  // Altri metodi della classe per interagire con il database PostgreSQL
  // Ad esempio: query, insert, update, delete, ecc.

  async closeConnection(): Promise<void> {
    if (this.client) {
      await this.client.end();
      logger.info('Connessione al database PostgreSQL chiusa');
    } else {
      logger.warn('Nessuna connessione al database PostgreSQL disponibile');
    }
  }
}