import { Router, Request, Response, NextFunction } from "express";
import { check } from "express-validator";
import BookingSettingsServices from "../components/services/bookingSettingsServices";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import authMiddleware from "../middlewares/authMiddleware";
import checkPermissionMiddleware from "../middlewares/checkPermissionMiddleware";
import { role } from "../enum/role";
import { db } from "../index";
import { MAX_BOOKING_CUTOFF_MINUTES, MAX_REFUND_CUTOFF_DAYS } from "../utils/bookingSettings";

const router = Router();

// Pubblica: il front ne ha bisogno per mostrare scadenze di rimborso e avvisi (solo numeri, nessun dato sensibile)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ settings: await new BookingSettingsServices(db).get() });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/",
  authMiddleware,
  [
    check("bookingCutoffMinutes").optional().isInt({ min: 0, max: MAX_BOOKING_CUTOFF_MINUTES }).withMessage(`bookingCutoffMinutes must be between 0 and ${MAX_BOOKING_CUTOFF_MINUTES}`),
    check("refundCutoffDays").optional().isInt({ min: 0, max: MAX_REFUND_CUTOFF_DAYS }).withMessage(`refundCutoffDays must be between 0 and ${MAX_REFUND_CUTOFF_DAYS}`),
  ],
  checkPermissionMiddleware(role.ADMIN, ["MANAGE_SETTINGS"]),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // solo i campi previsti (niente mass-assignment)
      const patch: any = {};
      if (req.body.bookingCutoffMinutes !== undefined) patch.bookingCutoffMinutes = Number(req.body.bookingCutoffMinutes);
      if (req.body.refundCutoffDays !== undefined) patch.refundCutoffDays = Number(req.body.refundCutoffDays);
      await new BookingSettingsServices(db).update(patch);
      res.json({ message: "Booking settings updated" });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
