import express from 'express';
import { db } from '../index';
import ExempleServices from '../components/services/exempleServices';
const router = express.Router();

router.get('/:id?', async (req, res, next) => {
  try {
    let exemple = new ExempleServices(db);
    let id = req.params.id ? req.params.id : '';
    const result = await exemple.read(id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    let exemple = new ExempleServices(db);
    let result = await exemple.write();
    res.locals.response.object = result;
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
