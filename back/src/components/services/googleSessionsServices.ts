import { Db } from 'mongodb';
import GoogleSessionsDao from '../dao/googleSessionsDao';

class GoogleSessionServices {
  private googleSessionsDao: GoogleSessionsDao;

  constructor(db: Db) {
    this.googleSessionsDao = new GoogleSessionsDao(db);
  }

  async insertGoogleSession(email: string) {
    await this.deleteGoogleSessionByEmail(email);
    return this.googleSessionsDao.insertGoogleSession(email);
  }

  async readGoogleSessionByToken(token: string): Promise<string> {
    await this.googleSessionsDao.deleteOlderThen30Minutes();
    return this.googleSessionsDao.readGoogleSessionByToken(token);
  }

  async deleteOlderThen30Minutes() {
    await this.googleSessionsDao.deleteOlderThen30Minutes();
  }

  async deleteGoogleSessionByEmail(email: string) {
    await this.googleSessionsDao.deleteGoogleSessionByEmail(email);
  }
}

export default GoogleSessionServices;
