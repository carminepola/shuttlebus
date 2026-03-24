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
import MailService from "../components/services/mailServices";
import { Mail } from "../model/mailModel";
const router = express.Router();
let requiredRole = "USER_MANAGEMENT";

router.get("/email/:email", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
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
  "/register",
  [
    check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"),
    check("password").notEmpty().withMessage("password is required"),
    check("name").notEmpty().withMessage("name is required"),
  ],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let result: any;
      let user: userModel = new userModel();
      let language = req.body.lng;
      user.email = req.body.email;
      user.password = req.body.password;
      user.details.name = req.body.name;
      user.details.phone = req.body.phoneNumber;
      user.role = role.NO_PERMISSION;
      user.disabled = false;
      user.options.lng = language;
      user.privacyAndPolicy = true;
      user.privacyAndPolicyConfirmDate = new Date().getTime();

      let userServices = new UserServices(db);
      result = await userServices.register(user, language);

      res.json({ message: "Registrazione effettuata con successo" });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);

router.post(
  "/validateEmail",
  [
    check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"),
    check("pin").notEmpty().withMessage("pin is required").isNumeric().withMessage("pin must be a number"),
  ],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let result: any;
      let email = req.body.email;
      let pin = req.body.pin;

      let userServices = new UserServices(db);
      await userServices.validateEmail(email, pin);

      res.json({ message: "Email validata con successo" });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);
router.post(
  "/",
  [
    check("email").notEmpty().withMessage("email is required").isEmail().withMessage("Invalid email format"),
    check("password").notEmpty().withMessage("password is required"),
    check("name").notEmpty().withMessage("name is required"),
  ],
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, [requiredRole]),
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
  },
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
  },
);

router.patch(
  "/updateDetails",
  [check("name").notEmpty().withMessage("name is required"), check("phone").optional().isString().withMessage("phone must be a string")],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let email = res.locals.userLogged.email;
      let userServices = new UserServices(db);

      const result = await userServices.updateUserDetails(email, req.body.name, req.body.phone);
      res.json({ message: "Dettagli aggiornati con successo", user: result });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);

router.get("/getNormalUser", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userServices = new UserServices(db);
    const result = await userServices.getNormalUser();
    res.json({ listUser: result });
  } catch (error) {
    next(error);
  }
});

router.get("/me", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let email = res.locals.userLogged.email;
    let userServices = new UserServices(db);
    const result = await userServices.getUserByEmailAll(email);
    res.json(result);
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.get("/search", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const searchTerm = req.query.search as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    let userServices = new UserServices(db);
    const result = await userServices.searchUsers(searchTerm, page, limit);
    res.json(result);
  } catch (error) {
    logger.error(error);
    next(error);
  }
});

router.put(
  "/updateOptions",
  [check("options").notEmpty().withMessage("options is required").isObject().withMessage("options must be an object"), check("options.*").exists().withMessage("options must not be empty")],
  authMiddleware,
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let result: any;

      console.log("options");
      let email = res.locals.userLogged.email;
      let userServices = new UserServices(db);

      let options: { [key: string]: string } = req.body.options;

      for (const key in options) {
        if (options.hasOwnProperty(key)) {
          const value = options[key];
          result = await userServices.updateOptions(email, key, value);
        }
      }

      return res.status(205).json({ message: "Opzioni aggiornate con successo" });
    } catch (error) {
      logger.error(error);
      next(error);
    }
  },
);
router.get("/:id?", authMiddleware, checkPermissionMiddleware(role.ADMIN, [requiredRole]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userServices = new UserServices(db);
    let id = req.params.id ? req.params.id : undefined;
    if (id) {
      const result = await userServices.getUserById(id);
      res.json(result);
    } else {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await userServices.getUsers(page, limit);
      res.json(result);
    }
  } catch (error) {
    logger.error(error);
    next(error);
  }
});
export default router;
