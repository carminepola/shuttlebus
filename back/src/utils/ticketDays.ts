/**
 * Giorni di validita' dei tipi di biglietto (es. "Turista weekend" solo sab/dom,
 * "Over 60" solo il martedi'). Convenzione ISO come le corse: 1 = lunedi' ... 7 = domenica.
 * Lista vuota o assente = valido tutti i giorni.
 */

/** Normalizza l'input admin: interi 1..7 unici e ordinati; tutti e 7 = nessuna restrizione. */
export function sanitizeDaysOfWeek(days: any): number[] {
  if (!Array.isArray(days)) return [];
  const set = new Set<number>();
  for (const d of days) {
    const n = typeof d === "string" && d.trim() !== "" ? Number(d) : d;
    if (Number.isInteger(n) && n >= 1 && n <= 7) set.add(n);
  }
  return set.size === 7 ? [] : [...set].sort((a, b) => a - b);
}

/** Giorno ISO (1..7) di una data "YYYY-MM-DD", indipendente dal fuso del server. */
export function isoWeekday(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return d === 0 ? 7 : d;
}

export function isTicketTypeValidOn(ticketType: any, date: string): boolean {
  const days: number[] = Array.isArray(ticketType?.daysOfWeek) ? ticketType.daysOfWeek : [];
  if (days.length === 0) return true;
  const day = isoWeekday(date);
  return day !== null && days.includes(day);
}
