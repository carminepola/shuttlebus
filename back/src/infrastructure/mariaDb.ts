import { createPool, Pool, PoolConnection } from "mysql2";
import { logger } from "..";

 

export default class MariaDB {
  private databases: Map<string, Pool> = new Map();

  constructor() {}

  async init(connectionString:string,databaseName:string = 'default') {
     
      const pool = createPool( connectionString);
      this.databases.set(databaseName, pool);
 
  }

  async run(databaseName: string = 'default') {
    try {
      const pool = this.databases.get(databaseName);

      if (!pool) {
        throw new Error(`Database '${databaseName}' non trovato.`);
      }

      return new Promise<PoolConnection>((resolve, reject) => {
        pool.getConnection((error, connection) => {
          if (error) {
            reject(error);
          } else {
            logger.info(`Connesso al database MariaDB '${databaseName}'`);
            resolve(connection);
          }
        });
      });
    } catch (error) {
      throw error;
    }
  }

  isConnect(databaseName: string): boolean {
    const pool = this.databases.get(databaseName);
    return !!pool;
  }

  async close(databaseName: string): Promise<void> {
    const pool = this.databases.get(databaseName);

    if (pool) {
      await pool.end();
      logger.info(`Connessione a MariaDB '${databaseName}' chiusa`);
    } else {
      logger.warn(`Nessuna connessione a MariaDB '${databaseName}' disponibile`);
    }
  }
}
