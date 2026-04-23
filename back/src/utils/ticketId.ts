const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEIGHTS = [7, 3, 5, 2, 4];
const RANDOM_LENGTH = 5;
const BASE = 36;

function randomBase36(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * BASE).toString(BASE).toUpperCase();
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
