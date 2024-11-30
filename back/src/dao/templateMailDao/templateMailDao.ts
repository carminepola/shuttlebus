import { Db, ObjectId } from "mongodb";
import { logger } from "../../index";


export class TemplateMailDao {
  private collectionName: string;
  private db: Db;

  constructor(db: Db) {
    this.collectionName = "templateMail";
    this.db = db;
  }

  async readTemplateMailType(type: string): Promise<any | null> {
    try {
      const result = await this.db
        .collection(this.collectionName)
        .findOne<any>({ type: type });

      return result;
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }

}
