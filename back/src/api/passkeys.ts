import express, { Request, Response, NextFunction } from 'express';
import { db, env } from '../index';
import authMiddleware from '../middlewares/authMiddleware';
import PasskeyServices from '../components/services/passkeyServices';
import SessionServices from '../components/services/sessionServices';
import jwt from 'jsonwebtoken';
import { CookieOptions } from 'express';

const router = express.Router();

router.post('/registration/options', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = res.locals.userLogged.email;
    const passkeyServices = new PasskeyServices(db);
    const options = await passkeyServices.getRegistrationOptions(email);
    res.json(options);
  } catch (error) {
    next(error);
  }
});

router.post('/registration/verify', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = res.locals.userLogged.email;
    const { response, name } = req.body;
    if (!response) {
      throw new Error('Risposta WebAuthn mancante');
    }
    const passkeyServices = new PasskeyServices(db);
    const passkey = await passkeyServices.registerPasskey(email, response, name);
    res.json({ message: 'Passkey registrata con successo', passkey });
  } catch (error) {
    next(error);
  }
});

router.get('/', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = res.locals.userLogged.email;
    const passkeyServices = new PasskeyServices(db);
    const passkeys = await passkeyServices.getPasskeys(email);
    res.json(passkeys);
  } catch (error) {
    next(error);
  }
});

router.delete('/:passkeyId', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = res.locals.userLogged.email;
    const { passkeyId } = req.params;
    const passkeyServices = new PasskeyServices(db);
    const deleted = await passkeyServices.deletePasskey(email, passkeyId);
    if (!deleted) {
      throw new Error('Passkey non trovata');
    }
    res.json({ message: 'Passkey eliminata con successo' });
  } catch (error) {
    next(error);
  }
});

router.post('/authentication/options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new Error('Email richiesta');
    }
    const passkeyServices = new PasskeyServices(db);
    const options = await passkeyServices.getAuthenticationOptionsByEmail(email);
    res.json(options);
  } catch (error) {
    next(error);
  }
});

router.post('/authentication/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secretKey = env.SECRET_KEY || '';
    const { email, response, rememberMe } = req.body;
    if (!email || !response) {
      throw new Error('Email e risposta WebAuthn richieste');
    }

    const passkeyServices = new PasskeyServices(db);
    const verification = await passkeyServices.verifyAuthentication(email, response);

    if (!verification.verified) {
      throw new Error('Autenticazione fallita');
    }

    const sessionServices = new SessionServices(db);
    const loginResponse = await sessionServices.loginPasskey(email, rememberMe || false);

    const token = jwt.sign(loginResponse.userSession, secretKey, {
      expiresIn: '74h',
    });

    const refreshToken = jwt.sign(
      { refreshToken: loginResponse.sessionToken.refreshToken },
      secretKey,
      { expiresIn: '30d' },
    );

    let settingsJwt: CookieOptions = {
      maxAge: undefined,
      httpOnly: false,
      sameSite: env.NODE_ENV === 'PROD' || env.NODE_ENV === 'TEST' ? 'none' : 'strict',
      secure: env.NODE_ENV === 'PROD' || env.NODE_ENV === 'TEST',
    };

    if (rememberMe) {
      settingsJwt.maxAge = 2592000000;
      res.cookie('refreshToken', refreshToken, {
        maxAge: 2592000000,
        httpOnly: true,
        sameSite: env.NODE_ENV === 'PROD' || env.NODE_ENV === 'TEST' ? 'none' : 'strict',
        secure: env.NODE_ENV === 'PROD' || env.NODE_ENV === 'TEST',
      });
    }

    res.cookie('jwt', token, settingsJwt);

    res.json({ message: 'Accesso autorizzato tramite passkey' });
  } catch (error) {
    next(error);
  }
});

export default router;
