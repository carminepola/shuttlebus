import { Router, Request, Response, NextFunction } from "express";
import { check, validationResult } from "express-validator";
import TicketTypeServices from "../components/services/ticketTypeServices";
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
    check("name").optional().isObject().withMessage("name must be an object { <lingua>: testo }"),
    check("description").optional().isObject().withMessage("description must be an object { <lingua>: testo }"),
    check("cost").notEmpty().isNumeric().withMessage("Cost is required number"),
    check("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
    check("showOnHome").optional().isBoolean().withMessage("showOnHome must be a boolean"),
    check("daysOfWeek").optional().isArray().withMessage("daysOfWeek must be an array"),
  ],

  checkPermissionMiddleware(role.ADMIN, ["MANAGE_TICKET"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body.imagePaths) {
        req.body.image = req.body.imagePaths[0];
      }
      let stopsServices = new TicketTypeServices(db);
      const id = await stopsServices.createTicketType(req.body);
      res.status(201).json({ message: "Ticket Created", id: id });
    } catch (error) {
      next(error);
    }
  },
);

// anche i biglietti disattivati: solo per la gestione admin (gli utenti usano /all)
router.get("/", authMiddleware, checkPermissionMiddleware(role.ADMIN, ["MANAGE_TICKET"]), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let ticketTypeServices = new TicketTypeServices(db);
    const ticketType = await ticketTypeServices.getAllTicketTypes();
    res.json({ ticketType: ticketType });
  } catch (error) {
    next(error);
  }
});
router.get("/id/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.params.id) {
      throw new ErrorModel(400, "Id is required");
    } else if (req.params.id === "0") {
      res.json({ ticketType: new ticketTypeModel() });
    } else {
      let ticketTypeServices = new TicketTypeServices(db);
      const ticketTypeData = await ticketTypeServices.getTicketType(req.params.id);
      res.json({ ticketType: ticketTypeData });
      if (!ticketTypeData) {
        throw new ErrorModel(404, "ticket type not found");
      }
    }
  } catch (error) {
    next(error);
  }
});

router.get("/all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let ticketTypeServices = new TicketTypeServices(db);
    const ticketType = await ticketTypeServices.getAllActiveTicketTypes();
    res.json({ ticketType: ticketType });
  } catch (error) {
    next(error);
  }
});
router.patch(
  "/",
  [
    check("id").notEmpty().withMessage("Id is required").isString().withMessage("id must be a string"),
    check("name").optional().isObject().withMessage("name must be an object { <lingua>: testo }"),
    check("description").optional().isObject().withMessage("description must be an object { <lingua>: testo }"),
    check("cost").notEmpty().isNumeric().withMessage("Cost is required number"),
    check("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
    check("showOnHome").optional().isBoolean().withMessage("showOnHome must be a boolean"),
    check("daysOfWeek").optional().isArray().withMessage("daysOfWeek must be an array"),
  ],

  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_TICKET"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let ticketTypeServices = new TicketTypeServices(db);

      await ticketTypeServices.updateTicketType(req.body);
      res.json({ message: "Ticket updated" });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id",
  // pentest: prima senza alcuna autenticazione (DELETE tipi biglietto aperto a chiunque)
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_TICKET"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let ticketTypeServices = new TicketTypeServices(db);
      const id = req.params.id;
      await ticketTypeServices.deleteTicketType(id);
      res.json({ message: "Ticket deleted" });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
