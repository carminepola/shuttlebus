import { randomInt } from "crypto";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEIGHTS = [7, 3, 5, 2, 4];
// P-03 (ticket ID predictability): 5 caratteri base-36 = ~26 bit, e Math.random()
// e' un PRNG NON crittografico (xorshift128+: lo stato interno si ricostruisce
// osservando gli output e si predicono gli ID successivi). Con 10 caratteri
// CSPRNG lo spazio sale a 36^10 = 3,6e15 (~2^51.7): non indovinabile online e
// offline-feasibile solo con costi irrealistici. validateTicketId e' gia'
// tollerante sulla lunghezza: gli ID legacy a 5 restano validi.
const RANDOM_LENGTH = 10;
const BASE = 36;

function randomBase36(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    // CSPRNG del core Node: nessun stato condiviso/predicibile come Math.random()
    result += randomInt(0, BASE).toString(BASE).toUpperCase();
  }
  return result;
}

export function checkDigit(chars: string): string {
  let sum = 0;
  for (let i = 0; i < chars.length; i++) {
    sum += parseInt(chars[i], BASE) * WEIGHTS[i % WEIGHTS.length];
  }
  return (sum % BASE).toString(BASE).toUpperCase();
}

export function generateTicketId(date: string, email: string): string {
  const d = new Date(date + "T00:00:00");
  const year = d.getFullYear().toString().slice(-2);
  const month = MONTHS[d.getMonth()];
  const day = d.getDate().toString().padStart(2, "0");
  const emailInitial = (email || "X").charAt(0).toUpperCase();
  const random = randomBase36(RANDOM_LENGTH);
  const check = checkDigit(random);
  return `SB${year}${month}${day}${emailInitial}${random}${check}`;
}

export function validateTicketId(id: string): boolean {
  if (!id || id.length < 4 || !id.startsWith("SB")) return false;
  const randomPart = id.slice(-RANDOM_LENGTH - 1, -1);
  const checkChar = id.slice(-1);
  return checkDigit(randomPart) === checkChar;
}
