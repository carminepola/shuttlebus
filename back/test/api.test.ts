import request from 'supertest';

import app from '../src/app';
import { restServer } from '../src/index';
 

//aspetto che il db sia connesso
const waitOneSecond = () => new Promise(resolve => setTimeout(resolve, 1000));
const waitStart = async () => { 
  for (let i = 0; i < 4 && ( !restServer.isServerRunning()); i++) { 
    await waitOneSecond();
  } 
  if (!restServer.isServerRunning()) {
    throw new Error('Impossibile avviare rest');
  }
};

beforeAll(waitStart);


describe('GET /api', () => {
  it('responds with a json message',  (done) => {
    request(app)
      .get('/api')
      .set('Accept', 'application/json')
      .expect('Content-Type', /json/)
      .expect((res) => {
        const expectedObject = { message: 'V1' };
        const actualObject = res.body.object;
        expect(actualObject).toMatchObject(expectedObject);
      })
      .expect(200, done);
  });
});

