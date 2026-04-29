import express, { CookieOptions } from 'express';
import { db, logger, env } from '../index';
import bcrypt from 'bcrypt';
import UserDao from '../components/dao/usersDao';
import { check, validationResult } from 'express-validator';
import ErrorModel from '../model/errorModel';

import { Request, Response, NextFunction } from 'express';
import validateDataMiddleware from '../middlewares/validateDataMiddleware';
import jwt from 'jsonwebtoken';
import authMiddleware from '../middlewares/authMiddleware';

import UserServices from '../components/services/userServices';
import FailToBanServices from '../components/services/failToBanServices';
import SessionServices from '../components/services/sessionServices';
import BookingsServices from '../components/services/bookingServices';
const router = express.Router();

router.post(
  '/',
  [check('email').notEmpty().withMessage('email is required').isEmail().withMessage('Invalid email format'), check('password').notEmpty().withMessage('password is required')],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      let secretKey = env.SECRET_KEY || '';
      let result = {};

      const token = req.cookies ? req.cookies.jwt : undefined;
      if (token) {
        let valid = true;
        jwt.verify(token, secretKey, (err: any, user: any) => {
          if (!err) {
            valid = false;
          }
        });
        if (!valid) {
          throw new ErrorModel(409, 'Utente già autenticato');
        }
      }

      let sessionServices = new SessionServices(db);
      let userServices = new UserServices(db);
      let failToBanServices = new FailToBanServices(db);

      if (await failToBanServices.isFail(res.locals.log.ip)) {
        throw new ErrorModel(429, 'Troppi tentativi. Riprova più tardi.');
      }

      let loginResponse = await sessionServices.login(req.body.email, req.body.password, req.body.rememberMe);

      if (await userServices.checkPassword(req.body.email, req.body.password)) {
        failToBanServices.deleteIp(res.locals.log.ip);

        let sessionToken = loginResponse.sessionToken;

        let userSession = loginResponse.userSession;

        let token: any = jwt.sign(userSession, secretKey, {
          expiresIn: '74h',
        });

        let refreshToken: any = jwt.sign(
          {
            refreshToken: sessionToken.refreshToken,
          },
          secretKey,
          {
            expiresIn: '30d',
          },
        );
        let settingsJwt: CookieOptions = {
          maxAge: undefined,
          httpOnly: false,
          sameSite: env.NODE_ENV === 'PROD' || env.NODE_ENV === 'TEST' ? 'none' : 'strict',
          secure: env.NODE_ENV === 'PROD' || env.NODE_ENV === 'TEST',
        };
        if (req.body.rememberMe) {
          settingsJwt.maxAge = 2592000000;
          res.cookie('refreshToken', refreshToken, {
            maxAge: 2592000000,
            httpOnly: true,
            sameSite: env.NODE_ENV === 'PROD' || env.NODE_ENV === 'TEST' ? 'none' : 'strict',
            secure: env.NODE_ENV === 'PROD' || env.NODE_ENV === 'TEST',
          });
        }

        res.cookie('jwt', token, settingsJwt);

        result = { message: 'Accesso autorizzato' };
      } else {
        failToBanServices.insertIp(res.locals.log.ip);
        throw new ErrorModel(400, 'Credenziali non valide. Riprova.');
      }
      res.json(result);
    } catch (error: ErrorModel | any) {
      next(error);
    }
  },
);
router.delete('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let result = {};

    let bookingsServices = new BookingsServices(db);
    let userId = res.locals.userLogged._id;
    let pendingBookings = await bookingsServices.getBookingFromUser(userId);

    if (pendingBookings && pendingBookings.length > 0) {
      for (let booking of pendingBookings) {
        if (booking.status === 'pending') {
          await bookingsServices.deleteBooking(booking.numberOfTickets, userId);
        }
      }
    }

    let userServices = new UserServices(db);
    let ris = await userServices.deleteSession(res.locals.userLogged.email, res.locals.userLogged.session);
    res.clearCookie('jwt');
    res.clearCookie('refreshToken');
    if (!ris) {
      throw new ErrorModel(404, 'Nessuna sessione trovata');
    } else {
      result = { message: 'Logout riuscito' };
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
});
router.delete('/all', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    let result = {};

    let userDao = new UserDao(db);
    await userDao.deleteAllExceptCurrentSession(res.locals.userLogged.email, res.locals.userLogged.session);
    result = { message: 'Tutte le sessioni cancellate eccetto quella in uso' };

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/refreshToken', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  let result = {};
  result = { message: 'User upgraded' };
  res.json(result);
});

router.patch('/terms', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  let result = {};
  let userServices = new UserServices(db);

  userServices.acceptTerms(res.locals.userLogged._id);

  result = { message: 'User upgraded' };
  res.json(result);
});
router.post('/recoverPassword', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let userDao = new UserDao(db);
    let email = req.body.email;
    let lng = req.body.lng ? (req.body.lng == 'it' ? 'it' : 'en') : 'en';
    let user = await userDao.getUserByEmail(email);
    if (user) {
      await userDao.insertRecoverPassword(user.email, user.details.name, lng);
    }
    res.json({ message: "Una nuova password sarà inviata all'indirizzo email" });
  } catch (error) {
    next(error);
  }
});

export default router;
