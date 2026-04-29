import { Db } from 'mongodb';
import { logger } from '../..';
import licensePlateModel from '../../model/licensePlateModel';

export default class LicensePlateDao {
  db: Db;

  schema: string = 'licensePlates';

  constructor(db: Db) {
    this.db = db;
  }

  async create(obj: licensePlateModel) {
    try {
      const result = await this.db.collection(this.schema).insertOne(obj);
      return result.insertedId;
    } catch (error) {
      logger.error('Error creating license plate:', error);
      throw error;
    }
  }

  async getAll() {
    try {
      return await this.db.collection(this.schema).find().toArray();
    } catch (error) {
      logger.error('Error retrieving all license plates:', error);
      throw error;
    }
  }

  async getById(id: string) {
    try {
      return await this.db.collection(this.schema).findOne({ id: id });
    } catch (error) {
      logger.error('Error retrieving license plate by id:', error);
      throw error;
    }
  }

  async getByLicensePlate(licensePlate: string) {
    try {
      return await this.db.collection(this.schema).findOne({ licensePlate: licensePlate });
    } catch (error) {
      logger.error('Error retrieving license plate by license plate:', error);
      throw error;
    }
  }

  async getEnabled() {
    try {
      return await this.db.collection(this.schema).find({ enabled: true }).toArray();
    } catch (error) {
      logger.error('Error retrieving enabled license plates:', error);
      throw error;
    }
  }

  async update(obj: licensePlateModel) {
    try {
      const result = await this.db.collection(this.schema).updateOne({ id: obj.id }, { $set: obj });
      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Error updating license plate:', error);
      throw error;
    }
  }

  async delete(id: string) {
    try {
      const result = await this.db.collection(this.schema).deleteOne({ id: id });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Error deleting license plate:', error);
      throw error;
    }
  }
}
