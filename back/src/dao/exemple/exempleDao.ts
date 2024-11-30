import { Db, ObjectId } from "mongodb";
import { Guid } from "guid-typescript";
import { logger } from "../..";
import MailService from "../../services/mailServices";

export default class ExempleDao {
  db: Db;
  schema: string = "exemple";
  logInfo: any;

  constructor(db: Db, logInfo?: any) {
    this.db = db;
    this.logInfo = logInfo;
  }

  async read(id: string) {
    try {



      let mailService = new MailService()

await      mailService.createAndSendMail({
        to: "info@carminepola.it",
        type:"welcome",
        titleVariable: {
          name: "Carmine",
          surname: "Pola",
        },
        bodyVariable: {
          name: "Carmine",
          surname: "Pola",
        },
      })
      

      let json = {};

      if (id) {
        json = {
          _id: new ObjectId(id),
        };
      }

      logger.debug("Leggo dal db", this.logInfo);

      return this.db.collection(this.schema).find(json).toArray();
    } catch (error) {
      throw error;
    }
  }

  async write() {
    try {
      let insert: any = { test: Guid.create().toString() };

      const result = await this.db.collection(this.schema).insertOne(insert);

      if (result.insertedId) {
        insert._id = result.insertedId;
        // Inserimento riuscito, restituisci il risultato
        return insert;
      } else {
        throw new Error("Errore durante l'inserimento nel database");
      }
    } catch (error) {
      throw error;
    }
  }
}
