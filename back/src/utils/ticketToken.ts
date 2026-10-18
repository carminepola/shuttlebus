import crypto from "crypto";

/**
 * Token opaco firmato (HMAC-SHA256) che lega la prenotazione al possessore
 * e al numero di biglietti. Il client non costruisce piu' i dati del QR:
 * riceve `numberOfTickets.sig` generato dal server solo per prenotazioni pagate.
 */

function getSecret(): string {
  const secret = process.env.SECRET_KEY;
  if (!secret) {
    throw new Error("SECRET_KEY non configurato");
  }
  return secret;
}

function hmac(numberOfTickets: string, userId: string, seats: number): string {
  return crypto.createHmac("sha256", getSecret()).update(`${numberOfTickets}|${userId}|${seats}`).digest("base64url");
}

export function signTicketToken(numberOfTickets: string, userId: string, seats: number): string {
  return `${numberOfTickets}.${hmac(numberOfTickets, userId, seats)}`;
}

export function verifyTicketToken(token: string, userId: string, seats: number): string | null {
  if (!token || typeof token !== "string") return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;
  const numberOfTickets = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = hmac(numberOfTickets, userId, seats);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return numberOfTickets;
}
