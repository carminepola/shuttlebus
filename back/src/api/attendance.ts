import { Router, Request, Response, NextFunction } from "express";
import { check } from "express-validator";
import AttendanceServices from "../components/services/attendanceServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";

import { db } from "../index";

import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";

const router = Router();

router.get(
  "/",
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, []),
  [check("year").notEmpty().withMessage("Year is required"), check("month").notEmpty().withMessage("Month is required")],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let attendanceServices = new AttendanceServices(db);
      const year = Number(req.query.year);
      const month = Number(req.query.month);
      const attendances = await attendanceServices.getByMonth(year, month);
      res.json({ attendances });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/",
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, []),
  [
    check("year").notEmpty().withMessage("Year is required"),
    check("month").notEmpty().withMessage("Month is required"),
    check("name").notEmpty().withMessage("Name is required"),
  ],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let attendanceServices = new AttendanceServices(db);
      const id = await attendanceServices.create(req.body);
      res.status(201).json({ message: "Person added", id });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/",
  authMiddleware,
  checkPermissionMiddleware(role.ADMIN, []),
  [
    check("id").notEmpty().withMessage("Id is required"),
    check("name").notEmpty().withMessage("Name is required"),
    check("days").exists().withMessage("Days is required"),
  ],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let attendanceServices = new AttendanceServices(db);
      const success = await attendanceServices.update(req.body);
      if (success) {
        res.status(200).json({ message: "Attendance updated" });
      } else {
        res.status(404).json({ message: "Attendance not found" });
      }
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/:id", authMiddleware, checkPermissionMiddleware(role.ADMIN, []), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let attendanceServices = new AttendanceServices(db);
    const id = req.params.id;
    const success = await attendanceServices.delete(id);
    if (success) {
      res.json({ message: "Attendance deleted" });
    } else {
      res.status(404).json({ message: "Attendance not found" });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
