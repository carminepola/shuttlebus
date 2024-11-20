import express from "express";
import { db, logger } from "../index";

import ExempleDao from "../dao/exemple/exempleDao";
const router = express.Router();


router.get("/:id?", async (req, res, next) => {
  try {
    let exempleDao = new ExempleDao(db, res.locals.log);
    let id = req.params.id ? req.params.id : "";
    const result = await exempleDao.read(id);

    res.json(result);
  } catch (error) {
    next(error);
  }
});
router.post("/", async (req, res, next) => {
  try {
    let exempleDao = new ExempleDao(db)
    let result = await exempleDao.write();
    res.locals.response.object = result;
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
