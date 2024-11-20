import { Db, ObjectId } from "mongodb";
import { logger } from "../..";
import bcrypt from "bcrypt";

export interface leadsDocument {}

export default class personDao {
  db: Db;
  schema: string = "persons";

  constructor(db: Db) {
    this.db = db;
  }

  async getPerson() {
    try {
      const randomPerson = await this.db.collection(this.schema).findOneAndUpdate({}, { $inc: { usato: 1 } }, { sort: { usato: 1 } });
      return randomPerson || undefined;
    } catch (error) {
      throw error;
    }
  }

  async insertPerson(persons: Array<any>) {
    try {
      for (const person of persons) {
        // Cerca un record con lo stesso numero di telefono nel database
        let existingPerson = await this.db.collection(this.schema).findOneAndUpdate(
          { numero: person.numero }, // Criterio di ricerca
          { $set: person }, // Dati da aggiornare o inserire
          { upsert: true } // Opzioni: upsert crea un nuovo record se non esiste, returnOriginal restituisce il record aggiornato
        );
      }
      return true;
    } catch (error) {
      throw error;
    }
  }
}
