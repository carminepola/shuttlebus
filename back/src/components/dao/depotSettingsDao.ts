import { Db } from 'mongodb';
import { logger } from '../..';
import depotSettingsModel from '../../model/depotSettingsModel';

export default class DepotSettingsDao {
  db: Db;

  schema: string = 'depotSettings';

  constructor(db: Db) {
    this.db = db;
  }

  async get() {
    try {
      const settings = await this.db.collection(this.schema).findOne({ id: 'default' });
      if (!settings) {
        // Se non esistono impostazioni, restituisci quelle di default
        return new depotSettingsModel();
      }
      return settings;
    } catch (error) {
      logger.error('Error retrieving depot settings:', error);
      throw error;
    }
  }

  async update(obj: depotSettingsModel) {
    try {
      const result = await this.db.collection(this.schema).updateOne({ id: 'default' }, { $set: obj }, { upsert: true });
      return result.modifiedCount > 0 || result.upsertedCount > 0;
    } catch (error) {
      logger.error('Error updating depot settings:', error);
      throw error;
    }
  }
}
