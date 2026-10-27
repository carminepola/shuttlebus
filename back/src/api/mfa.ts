import express from "express";
import { Request, Response, NextFunction } from "express";
import { check } from "express-validator";
import { db } from "../index";
import authMiddleware from "../middlewares/authMiddleware";
import validateDataMiddleware from "../middlewares/validateDataMiddleware";
import { authIpLimiter } from "../middlewares/authRateLimitMiddleware";
import MfaServices from "../components/services/mfaServices";
import FailToBanServices from "../components/services/failToBanServices";
import ErrorModel from "../model/errorModel";

// Gestione dei fattori di autenticazione dell'utente loggato (pagina account).
// Tutte le rotte agiscono SOLO sull'utente della sessione (userId dal token).
const router = express.Router();

const codeCheck = [check("code").notEmpty().withMessage("code is required")];

/**
 * Anti-bruteforce sui codici richiesti per attivare/disattivare un fattore:
 * stessa chiave failToBan del login 2FA, cosi' i tentativi si sommano.
 */
async function withCodeGuard(userId: string, action: () => Promise<void>) {
  const failToBanServices = new FailToBanServices(db);
  const failKey = `mfa:${userId}`;
  if (await failToBanServices.isRateLimited(failKey)) {
    throw new ErrorModel(429, "Troppi tentativi. Riprova più tardi.");
  }
  try {
    await action();
  } catch (error: any) {
    if (error?.code === 400) await failToBanServices.insertIp(failKey);
    throw error;
  }
  await failToBanServices.deleteIp(failKey);
}

router.get("/status", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await new MfaServices(db).getStatus(res.locals.userLogged._id));
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- app (TOTP)

router.post("/totp/setup", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = res.locals.userLogged;
    res.json(await new MfaServices(db).setupTotp(user._id, user.email));
  } catch (error) {
    next(error);
  }
});

router.post("/totp/enable", authMiddleware, authIpLimiter, codeCheck, validateDataMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = res.locals.userLogged._id;
    let recoveryCodes: string[] | null = null;
    await withCodeGuard(userId, async () => {
      recoveryCodes = await new MfaServices(db).enableTotp(userId, String(req.body.code));
    });
    res.json({ message: "Autenticazione con app attivata", recoveryCodes });
  } catch (error) {
    next(error);
  }
});

router.post("/totp/disable", authMiddleware, authIpLimiter, codeCheck, validateDataMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = res.locals.userLogged._id;
    await withCodeGuard(userId, () => new MfaServices(db).disableTotp(userId, String(req.body.code)));
    res.json({ message: "Autenticazione con app disattivata" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- email

/** Invia un codice all'email dell'account: serve sia per attivare sia per disattivare. */
router.post("/email/send", authMiddleware, authIpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = res.locals.userLogged;
    await new MfaServices(db).sendEmailCode(user._id, user.email, user.options?.lng);
    res.json({ message: "Codice inviato" });
  } catch (error) {
    next(error);
  }
});

router.post("/email/enable", authMiddleware, authIpLimiter, codeCheck, validateDataMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = res.locals.userLogged._id;
    let recoveryCodes: string[] | null = null;
    await withCodeGuard(userId, async () => {
      recoveryCodes = await new MfaServices(db).enableEmail(userId, String(req.body.code));
    });
    res.json({ message: "Autenticazione via email attivata", recoveryCodes });
  } catch (error) {
    next(error);
  }
});

router.post("/email/disable", authMiddleware, authIpLimiter, codeCheck, validateDataMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = res.locals.userLogged._id;
    await withCodeGuard(userId, () => new MfaServices(db).disableEmail(userId, String(req.body.code)));
    res.json({ message: "Autenticazione via email disattivata" });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- codici di recupero

router.post(
  "/recovery/regenerate",
  authMiddleware,
  authIpLimiter,
  [...codeCheck, check("method").isIn(["totp", "email"]).withMessage("method non valido")],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = res.locals.userLogged._id;
      let recoveryCodes: string[] = [];
      await withCodeGuard(userId, async () => {
        recoveryCodes = await new MfaServices(db).regenerateRecoveryCodes(userId, req.body.method, String(req.body.code));
      });
      res.json({ message: "Codici di recupero rigenerati", recoveryCodes });
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------- passkey

router.post("/passkey/options", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = res.locals.userLogged;
    res.json(await new MfaServices(db).passkeyRegistrationOptions(user._id, user.email, user.details?.name));
  } catch (error) {
    next(error);
  }
});

router.post(
  "/passkey/verify",
  authMiddleware,
  [check("challengeId").notEmpty().withMessage("challengeId is required"), check("response").isObject().withMessage("response is required")],
  validateDataMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await new MfaServices(db).passkeyRegistrationVerify(res.locals.userLogged._id, req.body.challengeId, req.body.response, req.body.name);
      res.json({ message: "Passkey aggiunta" });
    } catch (error) {
      next(error);
    }
  },
);

router.delete("/passkey/:id", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await new MfaServices(db).removePasskey(res.locals.userLogged._id, String(req.params.id));
    res.json({ message: "Passkey rimossa" });
  } catch (error) {
    next(error);
  }
});

export default router;
