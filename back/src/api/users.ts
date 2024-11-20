import express from "express";
import { mongo, logger, env } from "../index";
import bcrypt from "bcrypt";
import UserDao from "../dao/user/userDao";
import { check, validationResult } from "express-validator"; // Aggiuntoimport { error } from "console";
import ErrorModel from "../model/errorModel";
import { exitCode } from "process";
import { Request, Response, NextFunction } from "express";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import authMiddleware from "../middlewares/authMiddleware";

const router = express.Router();

router.get("/:id?", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userDao = new UserDao(mongo.getDb());
    let id = req.params.id ? req.params.id : undefined;
    if (id) {
      const result = await userDao.readUserById(id);
      res.json(result);
    } else {
      const result = await userDao.readAllUsers();
      res.json(result);
    }
  } catch (error) {
    next(error);
  }
});
router.get("/username/:username", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userDao = new UserDao(mongo.getDb());
    let username = req.params.username;
    const result = await userDao.readUserByUsername(username);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
router.post(
  "/",
  [check("username").notEmpty().withMessage("username is required"), check("password").notEmpty().withMessage("password is required")],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let result: any;
      let user = { username: req.body.username, password: req.body.password };

      let userDao = new UserDao(mongo.getDb());

      let oldUser = await userDao.readUserByUsername(user.username);
      if (oldUser.length > 0) {
        res.locals.response.error = new ErrorModel("L'utente già esiste", 409);
      } else {
        result = await userDao.insertNewUser(user);
        res.locals.response.object = result;
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
router.patch(
  "/",
  [
    check("username").notEmpty().withMessage("username is required"),
    check("password").notEmpty().withMessage("password is required"),
    check("oldPassword").notEmpty().withMessage("oldPassword is required"),
  ],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let result: any;
      let user = {
        username: req.body.username,
        password: req.body.password,
        oldPassword: req.body.oldPassword,
      };

      let userDao = new UserDao(mongo.getDb());

      if (await userDao.checkPassword(user.username, user.oldPassword)) {
        result = await userDao.updatePassword(user);
        res.locals.response.object = result;
      } else {
        res.locals.response.error = new ErrorModel("Qualcosa è andato storto", 500);
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
