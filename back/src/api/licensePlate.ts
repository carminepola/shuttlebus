import { Router, Request, Response, NextFunction } from "express";
import { check, validationResult } from "express-validator";
import LicensePlateServices from "../components/services/licensePlateServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";

import { db } from "../index";

import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";

const router = Router();

router.post(
  "/",
  authMiddleware,
  [check("id").isEmpty().withMessage("Id not required"), check("licensePlate").notEmpty().withMessage("License plate is required"), check("imei").notEmpty().withMessage("IMEI is required")],
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let licensePlateServices = new LicensePlateServices(db);
      const id = await licensePlateServices.create(req.body);
      res.status(201).json({ message: "License plate created", id: id });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/",
  authMiddleware,
  [check("id").notEmpty().withMessage("Id is required"), check("licensePlate").notEmpty().withMessage("License plate is required"), check("imei").notEmpty().withMessage("IMEI is required")],
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let licensePlateServices = new LicensePlateServices(db);
      const success = await licensePlateServices.update(req.body);
      if (success) {
        res.status(200).json({ message: "License plate updated" });
      } else {
        res.status(404).json({ message: "License plate not found" });
      }
    } catch (error) {
      next(error);
    }
  },
);

router.get("/", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let licensePlateServices = new LicensePlateServices(db);
    const licensePlates = await licensePlateServices.getAll();
    res.json({ licensePlates });
  } catch (error) {
    next(error);
  }
});

router.get("/enabled", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let licensePlateServices = new LicensePlateServices(db);
    const licensePlates = await licensePlateServices.getEnabled();
    res.json({ licensePlates });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let licensePlateServices = new LicensePlateServices(db);
    const id = req.params.id;
    const licensePlate = await licensePlateServices.getById(id);
    if (licensePlate) {
      res.json({ licensePlate });
    } else {
      res.status(404).json({ message: "License plate not found" });
    }
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let licensePlateServices = new LicensePlateServices(db);
    const id = req.params.id;
    const success = await licensePlateServices.delete(id);
    if (success) {
      res.json({ message: "License plate deleted" });
    } else {
      res.status(404).json({ message: "License plate not found" });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
