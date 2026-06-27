import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import dotenv from "dotenv";
import { logger } from "./index";
import https from "https";

dotenv.config();

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "",
      },
      async (accessToken, refreshToken, profile: any, done) => {
        try {
          const data = await verifyGoogleAccessToken(accessToken);
          if (!data) {
            throw new Error("Access Token non valido");
          }

          // const phoneNumber = await getGooglePhoneNumber(accessToken);
          // profile.phoneNumber = phoneNumber;

          return done(null, profile);
        } catch (error) {
          logger.error(error);
        }
      }
    )
  );
}

if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_CALLBACK_URL) {
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID || "",
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET || "",
        callbackURL: process.env.MICROSOFT_CALLBACK_URL || "",
        scope: ["user.read"],
      },
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          return done(null, profile);
        } catch (error) {
          logger.error(error);
        }
      }
    )
  );
}

// Salva l'utente nella sessione
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj: any, done) => {
  done(null, obj);
});

async function getGooglePhoneNumber(accessToken: string) {
  return new Promise((resolve, reject) => {
    https
      .get(
        `https://people.googleapis.com/v1/people/me?personFields=phoneNumbers`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (json.error) {
                resolve(null);
              } else {
                resolve(json.phoneNumbers?.[0]?.value || null);
              }
            } catch (error) {
              reject(error);
            }
          });
        }
      )
      .on("error", (error) => reject(error));
  });
}

async function verifyGoogleAccessToken(accessToken: string) {
  return new Promise((resolve, reject) => {
    https
      .get(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              resolve(false);
            } else {
              resolve(json);
            }
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", (error) => reject(error));
  });
}
