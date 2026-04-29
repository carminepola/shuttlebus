import { Router, Request, Response, NextFunction } from 'express';
import { check, validationResult } from 'express-validator';
import DepotSettingsServices from '../components/services/depotSettingsServices';
import validateDataMiddleware from '../middlewares/validateDataMiddleware';

import { db } from '../index';

import authMiddleware from '../middlewares/authMiddleware';
import checkPermissionMiddleware from '../middlewares/checkPermissionMiddleware';
import { role } from '../enum/role';

const router = Router();

router.get('/', authMiddleware, checkPermissionMiddleware(role.ADMIN, ['MANAGE_SETTINGS']), async (req: Request, res: Response, next: NextFunction) => {
  try {
    let depotSettingsServices = new DepotSettingsServices(db);
    const settings = await depotSettingsServices.get();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/',
  authMiddleware,
  [
    check('depotLatitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Depot latitude must be between -90 and 90'),
    check('depotLongitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Depot longitude must be between -180 and 180'),
    check('depotRadius').optional().isInt({ min: 10, max: 10000 }).withMessage('Depot radius must be between 10 and 10000 meters'),
    check('gpsTimeout').optional().isInt({ min: 5, max: 120 }).withMessage('GPS timeout must be between 5 and 120 minutes'),
    check('completedRouteTolerance').optional().isInt({ min: 5, max: 120 }).withMessage('Completed route tolerance must be between 5 and 120 minutes'),
    check('stopDistanceThreshold').optional().isInt({ min: 50, max: 2000 }).withMessage('Stop distance threshold must be between 50 and 2000 meters'),
    check('defaultLastArrivalTime')
      .optional()
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Default last arrival time must be in HH:mm format'),
  ],
  checkPermissionMiddleware(role.ADMIN, ['MANAGE_SETTINGS']),
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let depotSettingsServices = new DepotSettingsServices(db);
      const success = await depotSettingsServices.update(req.body);
      if (success) {
        res.status(200).json({ message: 'Depot settings updated' });
      } else {
        res.status(500).json({ message: 'Failed to update depot settings' });
      }
    } catch (error) {
      next(error);
    }
  },
);

export default router;
