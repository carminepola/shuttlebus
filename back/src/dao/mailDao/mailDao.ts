import { Db } from "mongodb";
import { logger } from "../../index";
import { MailModel } from "../../model/mailModel";

export class MailDao {
  private db: Db;
  private schema: string = "mail";
  private logInfo: any;

  constructor(db: Db, logInfo?: any) {
    this.db = db;
    this.logInfo = logInfo ? logInfo : {};
  }

  async readAllMail(): Promise<any> {
    try {
      const result = await this.db
        .collection(this.schema)
        .find({})
        .toArray();

        return result
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async readMailById(id: string): Promise<any> {
    try {
      const result = await this.db
        .collection(this.schema)
        .findOne<MailModel>({ id: id });

      return result;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async createMail(mail: Partial<MailModel>): Promise<any> {
    try {
      const result = await this.db
        .collection(this.schema)
        .insertOne(mail);

      return {
        ...mail,
        id: result.insertedId,
      };
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async updateMail( mail: Partial<MailModel>): Promise<any | null> {
    try {
      const result = await this.db
        .collection(this.schema)
        .updateOne({ id: mail.id }, { $set: mail });

      if (result.matchedCount > 0) {
        return result
      }

      return null;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

  async updateTry(id: string, sended: boolean): Promise<void> {
    try {
      await this.db
        .collection(this.schema)
        .updateOne(
          { id },
          { $set: { lastTry: new Date().getTime(), tryNumber: { $inc: 1 }, sended } }
        );
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
}

