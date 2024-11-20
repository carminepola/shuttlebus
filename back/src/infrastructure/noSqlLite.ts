import { Database, OPEN_READWRITE, OPEN_CREATE } from "sqlite3";
import { logger } from "..";

export default class SQLite {
  private dbPath: string = "";
  private db: Database | undefined;

  constructor() {}

  init(dbPath: string) {
    return new Promise<void>((resolve, reject) => {
      this.dbPath = dbPath;
      this.db = new Database(this.dbPath, OPEN_READWRITE | OPEN_CREATE, (err) => {
        if (err) {
          logger.error("Errore durante la connessione al database SQLite", err);
          reject(err);
        } else {
          logger.info("Connessione al database SQLite stabilita");
          resolve();
        }
      });
    });
  }

  run(query: string, params?: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database non connesso"));
        return;
      }
      this.db.run(query, params, function (err) {
        if (err) {
          logger.error("Errore nell'esecuzione della query", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  get(query: string, params?: any[]): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database non connesso"));
        return;
      }
      this.db.all(query, params, (err, rows) => {
        if (err) {
          logger.error("Errore nell'esecuzione della query", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      this.db.close((err) => {
        if (err) {
          logger.error("Errore durante la chiusura del database", err);
          reject(err);
        } else {
          logger.info("Connessione al database SQLite chiusa");
          resolve();
        }
      });
    });
  }
  getDb(): Database {
    if (!this.db) {
      throw new Error("Database non connesso");
    }
    return this.db;
  }
}
