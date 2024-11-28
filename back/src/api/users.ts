import express from "express";
import { db, logger } from "../index";

import UserDao from "../dao/users/usersDao";
import { check } from "express-validator";

import ErrorModel from "../model/errorModel";

import { Request, Response, NextFunction } from "express";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import authMiddleware from "../middlewares/authMiddleware";
import userModel from "../interface/userModel";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
const router = express.Router();
router.get("/:id?", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["CREATE_USER"]), async (req: Request, res: Response, next: NextFunction) => {
  try {

    let userDao = new UserDao(db, res.locals.log);
    let id = req.params.id ? req.params.id : undefined;
    if (id) {
      const result = await userDao.readUserById(id);
      res.json(result);
    } else {
      const result = await userDao.readAllUsers();
      res.json(result);
    }
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.get("/email/:email", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {

    let userDao = new UserDao(db, res.locals.log);
    let email = req.params.email;
    const result = await userDao.readUserByEmail(email);
    res.json(result);
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.post(
  "/",
  [check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"), check("password").notEmpty().withMessage("password is required"), check("name").notEmpty().withMessage("name is required")],
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

      let userDao = new UserDao(db, res.locals.log);

      let oldUser = await userDao.readUserByEmail(user.email);
      if (oldUser) {

        res.locals.customErrorMessage = "Utente già esistente";
        return res.sendStatus(409);

      } else {

        result = await userDao.insertNewUser(user);
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

      let userDao = new UserDao(db, res.locals.log)

      if (await userDao.checkPassword(user.email, user.oldPassword)) {
        result = await userDao.updatePassword(user);
        res.locals.response.object = result;
      } else {
        res.locals.customErrorMessage = "Password errata";
        return res.sendStatus(400);

      }
      res.json(result);
    } catch (error) {
      logger.error(error);
      next(error);
    }
  }
);

export default router;

