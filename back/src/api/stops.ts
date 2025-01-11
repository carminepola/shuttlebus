import { Router, Request, Response, NextFunction } from "express";
import { check, validationResult } from "express-validator";
import StopsDao from "../components/dao/stopsDao";
import { db } from "../index"; // Assuming db is exported from index.ts
import StopModel from "../model/stopsModel";

const router = Router();
const stopsDao = new StopsDao(db);

router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stopData: StopModel = new req.body();
    const stopId = await stopsDao.createStop(stopData);
    res.status(201).json({ message: "Stop created", stopId });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stops = await stopsDao.getAllStops();
    res.json(stops);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updateData: StopModel = new StopModel(req.body);
    await stopsDao.updateStop(updateData);
    res.json({ message: "Stop updated" });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stopId = req.params.id;
    await stopsDao.deleteStop(stopId);
    res.json({ message: "Stop deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
