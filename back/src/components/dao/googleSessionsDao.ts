import { Guid } from "guid-typescript";
import { Db } from "mongodb";
import ErrorModel from "../../model/errorModel";

export default class googleSessionsDao {
  private db: Db;
  private schema: string = "googleSessions";

  constructor(db: Db) {
    this.db = db;
  }
  async insertGoogleSession(email: string): Promise<string> {
    try {
      let result = undefined;
      let guid = Guid.create().toString();

      result = await this.db.collection(this.schema).insertOne({ token: guid, email: email, insertedAt: Date.now() });

      if (result) {
        return guid;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }
  async deleteGoogleSessionByEmail(email: string) {
    try {
      await this.db.collection(this.schema).deleteMany({ email: email });
    } catch (error) {
      throw error;
    }
  }

  async deleteOlderThen30Minutes() {
    try {
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      await this.db.collection(this.schema).deleteMany({ insertedAt: { $lte: thirtyMinutesAgo } });
    } catch (error) {
      throw error;
    }
  }

  async readGoogleSessionByToken(token: string): Promise<string> {
    try {
      let result = undefined;

      result = await this.db.collection(this.schema).findOneAndDelete({ token: token });
      if (result && result.email) {
        return result.email;
      } else {
        throw new ErrorModel(401, "Token non valido o scaduto");
      }
    } catch (error) {
      throw error;
    }
  }
}
