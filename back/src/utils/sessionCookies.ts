import { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import { cookieSameSite, cookieSecure } from "../cookiePolicy";

/**
 * Emette i cookie di sessione (jwt + refreshToken) a partire dal risultato di
 * SessionServices.login/createUserSession. Stesse regole del login classico:
 * senza "ricordami" il jwt e' un cookie di sessione e non c'e' refreshToken.
 */
export function setSessionCookies(
  res: Response,
  loginResponse: { userSession: any; sessionToken: { newSession: String; refreshToken: String } },
  rememberMe: boolean,
) {
  const secretKey = process.env.SECRET_KEY!;
  const jwtToken = jwt.sign(loginResponse.userSession, secretKey, { expiresIn: "72h" });
  const refreshToken = jwt.sign({ refreshToken: loginResponse.sessionToken.refreshToken }, secretKey, { expiresIn: "30d" });

  const settingsJwt: CookieOptions = {
    maxAge: undefined,
    // Il JWT NON e' leggibile dal JavaScript (mitigazione furto via XSS)
    httpOnly: true,
    sameSite: cookieSameSite(),
    secure: cookieSecure(),
  };
  if (rememberMe) {
    settingsJwt.maxAge = 2592000000;
    res.cookie("refreshToken", refreshToken, {
      maxAge: 2592000000,
      httpOnly: true,
      sameSite: cookieSameSite(),
      secure: cookieSecure(),
    });
  }
  res.cookie("jwt", jwtToken, settingsJwt);
}
