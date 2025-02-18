import { Router, Request, Response, NextFunction } from "express";
import { check, validationResult } from "express-validator";
import StopsDao from "../components/dao/stopsDao";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";

import { db } from "../index"; // Assuming db is exported from index.ts
import StopModel from "../model/stopsModel";
import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import ErrorModel from "../model/errorModel";
import uploadImagesMiddleware from "../middlewares/uploadImage";
const router = Router();

router.post(
  "/",
  authMiddleware,
  uploadImagesMiddleware,
  [
    check("id").isEmpty().withMessage("Id not required"),
    check("name").notEmpty().withMessage("Name is required"),
    check("address").notEmpty().withMessage("address is required"),
    check("description.it").optional().isString().withMessage("Description in Italian must be a string"),
    check("description.en").optional().isString().withMessage("Description in English must be a string"),
    check("image").optional().isString().withMessage("Image must be a string"),
    check("location.latitude").notEmpty().withMessage("Latitude is required"),
    check("location.longitude").notEmpty().withMessage("Longitude is required"),
    check("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  ],

  checkPermissionMiddleware(role.ADMIN, ["MANAGE_STOPS"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.imagePaths) {
        req.body.image = req.body.imagePaths[0];
      }
      let stopsDao = new StopsDao(db);
      const stopData: StopModel = new StopModel(req.body);
      const stopId = await stopsDao.createStop(stopData);
      res.status(201).json({ message: "Stop created", id: stopId });
    } catch (error) {
      next(error);
    }
  }
);

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let stopsDao = new StopsDao(db);
    const stops = await stopsDao.getAllActiveStops();
    res.json({ stops: stops });
  } catch (error) {
    next(error);
  }
});
router.get("/id/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.params.id) {
      throw new ErrorModel(400, "Id is required");
    } else if (req.params.id === "0") {
      res.json({ stop: new StopModel() });
    } else {
      let stopsDao = new StopsDao(db);
      const stop = await stopsDao.getStops(req.params.id);
      res.json({ stop: stop });
      if (!stop) {
        throw new ErrorModel(404, "Stop not found");
      }
    }
  } catch (error) {
    next(error);
  }
});

router.get("/all", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["MANAGE_STOPS"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let stopsDao = new StopsDao(db);
    const stops = await stopsDao.getAllStops();
    res.json({ stops: stops });
  } catch (error) {
    next(error);
  }
});
router.patch(
  "/",
  [
    check("id").notEmpty().withMessage("Id is required").isString().withMessage("id must be a string"),
    check("name").notEmpty().withMessage("Name is required"),
    check("address").notEmpty().withMessage("address is required"),
    check("description.it").optional().isString().withMessage("Description in Italian must be a string"),
    check("description.en").optional().isString().withMessage("Description in English must be a string"),
    check("image").optional().isString().withMessage("Image must be a string"),
    check("location.latitude").notEmpty().withMessage("Latitude is required"),
    check("location.longitude").notEmpty().withMessage("Longitude is required"),
    check("isActive").isBoolean().withMessage("isActive must be a boolean"),
  ],

  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_STOPS"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.imagePaths) {
        req.body.image = req.body.imagePaths[0];
      }
      let stopsDao = new StopsDao(db);
      const updateData: StopModel = new StopModel(req.body);
      await stopsDao.updateStop(updateData);
      res.json({ message: "Stop updated" });
    } catch (error) {
      next(error);
    }
  }
);

router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let stopsDao = new StopsDao(db);
    const stopId = req.params.id;
    await stopsDao.deleteStop(stopId);
    res.json({ message: "Stop deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
