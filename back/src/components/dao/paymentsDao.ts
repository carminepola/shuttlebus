import { Db, ClientSession } from "mongodb";

export default class PaymentsDAO {
  private db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async getPaymentMethod() {
    return await this.db.collection("paymentMethods").findOne({ enabled: true });
  }
}
