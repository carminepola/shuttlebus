import { Db } from 'mongodb';
export default class permissionDao {
  db: Db;

  schema: string = 'permissions';

  constructor(db: Db) {
    this.db = db;
  }

  async insert(permission: { id: string, description: string }) {
    try {
      const existingPermission = await this.db.collection(this.schema).findOne({ id: permission.id });
      if (existingPermission) {
        throw new Error('Permission already exists');
      }
      const result = await this.db.collection(this.schema).insertOne(permission);
      return result.insertedId;
    } catch (error) {

      throw error;
    }
  }

  async delete(permissionId: string) {
    try {
      const result = await this.db.collection(this.schema).deleteOne({ id: permissionId });
      if (result.deletedCount === 0) {
        throw new Error('Permission not found');
      }
      return true;
    } catch (error) {

      throw error;
    }
  }

  async readAll() {
    try {
      const permissions = await this.db.collection(this.schema).find({}).toArray();
      return permissions;
    } catch (error) {

      throw error;
    }
  }
}

