import app from '../app';
import http from 'http'; // Importa il modulo http di Node.js
import { logger } from '../index';
export default class RestServer {
  private port: number;



  private serverRunning = false;

  constructor(port: number) {
    this.port = port;
  }

  isServerRunning(): boolean {
    return this.serverRunning;
  }

  run() {
    try {

      app.listen(this.port, () => {
        this.serverRunning = true;
        logger.info(`Server in ascolto all'indirizzo http://localhost:${this.port}`);
      });
    } catch (error) {
      logger.error('Errore in restServer: ' + JSON.stringify(error));
    }
  }
}
