import express from "express";
import { db, logger } from "../index";

import UserServices from "../components/services/userServices";
import { check } from "express-validator";

import ErrorModel from "../model/errorModel";

import { Request, Response, NextFunction } from "express";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import authMiddleware from "../middlewares/authMiddleware";
import userModel from "../model/userModel";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
const router = express.Router();
router.get("/:id?", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["CREATE_USER"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userServices = new UserServices(db);
    let id = req.params.id ? req.params.id : undefined;
    if (id) {
      const result = await userServices.getUserById(id);
      res.json(result);
    } else {
      const result = await userServices.getUsers();
      res.json(result);
    }
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.get("/email/:email", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userServices = new UserServices(db);
    let email = req.params.email;
    const result = await userServices.getUserByEmail(email);
    res.json(result);
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.post(
  "/",
  [
    check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"),
    check("password").notEmpty().withMessage("password is required"),
    check("name").notEmpty().withMessage("name is required"),
  ],
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, ["CREATE_USER"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let result: any;
      let user: userModel = new userModel();
      user.email = req.body.email;
      user.password = req.body.password;
      user.details.name = req.body.name;

      let userServices = new UserServices(db);
      let oldUser = await userServices.getUserByEmail(user.email);
      if (oldUser) {
        res.locals.customErrorMessage = "Utente già esistente";
        return res.sendStatus(409);
      } else {
        result = await userServices.createUser(user);
        res.locals.response.object = result;
      }
      res.json(result);
    } catch (error) {
      logger.error(error);
      next(error);
    }
  }
);

router.patch(
  "/changePassword",
  [
    check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"),
    check("password").notEmpty().withMessage("password is required"),
    check("oldPassword").notEmpty().withMessage("oldPassword is required"),
  ],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let result: any;
      let user = {
        email: req.body.email,
        password: req.body.password,
        oldPassword: req.body.oldPassword,
      };

      let userServices = new UserServices(db);

      result = await userServices.changePassword(user);
      res.json(result);
    } catch (error) {
      logger.error(error);
      next(error);
    }
  }
);

export default router;
