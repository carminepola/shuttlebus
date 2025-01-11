import { Db } from "mongodb";
import ExempleDao from "../dao/exempleDao";

class ExempleServices {
  private exempleDao: ExempleDao;

  constructor(db: Db) {
    this.exempleDao = new ExempleDao(db);
  }

  async read(id: string): Promise<any> {
    return this.exempleDao.read(id);
  }

  async write(): Promise<any> {
    return this.exempleDao.write();
  }
}

export default ExempleServices;
