import { Db } from "mongodb";

/**
 * DAO fail-to-ban con finestra temporale e backoff esponenziale.
 * Ogni chiave (email o IP) accumula i tentativi falliti degli ultimi
 * FAIL_WINDOW_MS; oltre FAIL_MAX_ATTEMPTS il login e' bloccato con
 * backoff esponenziale (raddoppia ad ogni tentativo fallito oltre il limite).
 */
export default class FailToBanDao {
  db: Db;
  schema: string = "failToBan";

  // Finestra di osservazione: 15 minuti
  public static readonly FAIL_WINDOW_MS = 15 * 60 * 1000;
  // Tentativi falliti concessi nella finestra prima del lockout
  public static readonly FAIL_MAX_ATTEMPTS = 5;

  constructor(db: Db) {
    this.db = db;
  }

  /**
   * Rimuove i tentativi fuori finestra e restituisce lo stato della chiave.
   */
  async getFailState(key: string): Promise<{ count: number; lastAttempt: number }> {
    try {
      const windowStart = new Date().getTime() - FailToBanDao.FAIL_WINDOW_MS;
      await this.db.collection(this.schema).deleteMany({ ip: key, date: { $lt: new Date(windowStart) } });
      const attempts = await this.db
        .collection(this.schema)
        .find({ ip: key, date: { $gte: new Date(windowStart) } })
        .sort({ date: -1 })
        .toArray();
      return {
        count: attempts.length,
        lastAttempt: attempts.length > 0 ? new Date(attempts[0].date).getTime() : 0,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Calcola se la chiave e' bloccata con backoff esponenziale:
   * oltre FAIL_MAX_ATTEMPTS il tempo di attesa raddoppia ad ogni
   * tentativo aggiuntivo (60s, 120s, 240s... max 15 minuti).
   */
  async isRateLimited(key: string): Promise<boolean> {
    try {
      const state = await this.getFailState(key);
      if (state.count < FailToBanDao.FAIL_MAX_ATTEMPTS) {
        return false;
      }
      const extraAttempts = state.count - FailToBanDao.FAIL_MAX_ATTEMPTS;
      const delayMs = Math.min(Math.pow(2, extraAttempts) * 60 * 1000, FailToBanDao.FAIL_WINDOW_MS);
      return new Date().getTime() - state.lastAttempt < delayMs;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Check if the given key is banned (more than 10 attempts in the window)
   * @param key the key (ip or email) to check
   * @returns true if the key is banned, false otherwise
   * @throws Error if there was an error during the operation
   */
  async isFail(key: string) {
    try {
      const state = await this.getFailState(key);
      return state.count >= 10;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete all documents with the given key
   * @param key the key to delete
   * @returns true if the operation was successful, false otherwise
   * @throws Error if there was an error during the operation
   */
  async deleteIp(key: string) {
    try {
      let result = undefined;

      result = await this.db.collection(this.schema).deleteMany({ ip: key });

      if (result) {
        return true;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }
  /**
   * Insert a failed attempt for the given key into the collection
   * @param key the key (ip or email) to insert
   * @returns true if the operation was successful, false otherwise
   * @throws Error if there was an error during the operation
   */
  async insertIp(key: string) {
    try {
      let result = await this.db.collection(this.schema).insertOne({ ip: key, date: new Date() });

      if (result) {
        return true;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }
}
