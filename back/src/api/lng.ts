import { Router, Request, Response, NextFunction } from "express";
import { check, validationResult } from "express-validator";
import LngServices from "../components/services/lngServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";

import { db } from "../index"; // Assuming db is exported from index.ts

import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import ErrorModel from "../model/errorModel";
import ticketTypeModel from "../model/ticketTypeModel";
const router = Router();

router.post(
  "/",
  authMiddleware,
  [
    check("id").isEmpty().withMessage("Id not required"),
    check("txt").isString().withMessage("txt must be a string"),
    check("it").isString().withMessage("name in Italian must be a string"),
    check("en").isString().withMessage("name in English must be a string"),
    check("fr").optional().isString().withMessage("name in French must be a string"),
    check("de").optional().isString().withMessage("name in German must be a string"),
    check("es").optional().isString().withMessage("name in Spanish must be a string"),
    check("jp").optional().isString().withMessage("name in Japanese must be a string"),
  ],

  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let lngServices = new LngServices(db);
      const id = await lngServices.create(req.body);
      res.status(201).json({ message: "lng Created", id: id });
    } catch (error) {
      next(error);
    }
  },
);
router.patch(
  "/",
  authMiddleware,
  [
    check("id").notEmpty().withMessage("Id is required"),
    check("it").isString().withMessage("name in Italian must be a string"),
    check("en").isString().withMessage("name in English must be a string"),
    check("fr").optional().isString().withMessage("name in French must be a string"),
    check("de").optional().isString().withMessage("name in German must be a string"),
    check("es").optional().isString().withMessage("name in Spanish must be a string"),
    check("jp").optional().isString().withMessage("name in Japanese must be a string"),
  ],

  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let lngServices = new LngServices(db);
      const id = await lngServices.update(req.body);
      res.status(201).json({ message: "lng Created", id: id });
    } catch (error) {
      next(error);
    }
  },
);
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let lngServices = new LngServices(db);
    const lng = await lngServices.getAll();
    res.json({ lng });
  } catch (error) {
    next(error);
  }
});
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let lngServices = new LngServices(db);
    const id = req.params.id;
    await lngServices.delete(id);
    res.json({ message: "lng deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
