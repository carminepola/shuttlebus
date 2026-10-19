import express from "express";
import { Request, Response, NextFunction } from "express";

const router = express.Router();

// Elenco PUBBLICO dei provider OAuth configurati: la UI nasconde i pulsanti di
// login per i provider i cui env non sono valorizzati. Stessa condizione di
// passportConfig.ts (una strategia esiste solo se i suoi env sono presenti).
// Espone SOLO la presenza della configurazione, mai i valori.
router.get("/", (req: Request, res: Response, next: NextFunction) => {
  try {
    const providers = {
      google: Boolean(
        process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL,
      ),
      microsoft: Boolean(
        process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_CALLBACK_URL,
      ),
      facebook: Boolean(
        process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET && process.env.FACEBOOK_CALLBACK_URL,
      ),
      spotify: Boolean(
        process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && process.env.SPOTIFY_CALLBACK_URL,
      ),
    };
    res.json({ providers });
  } catch (error) {
    next(error);
  }
});

export default router;
