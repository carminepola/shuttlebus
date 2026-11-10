/**
 * Chiusura delle vendite prima della partenza: una corsa non si prenota piu' a
 * meno di `cutoffMinutes` minuti dalla partenza (es. 120 = due ore prima,
 * 1440 = il giorno prima alla stessa ora). Il valore sta nelle impostazioni
 * (utils/bookingSettings.ts, Impostazioni -> Prenotazioni).
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Data "YYYY-MM-DD" nel fuso del server (lo stesso usato per gli orari delle corse). */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Orario di partenza della corsa ("HH:mm"): departureTime o, in mancanza, la prima fermata. */
export function scheduleDepartureTime(schedule: any): string | null {
  const candidates = [schedule?.departureTime, ...(Array.isArray(schedule?.stops) ? schedule.stops.map((s: any) => s?.stopTime) : [])];
  for (const t of candidates) {
    if (typeof t === "string" && /^\d{1,2}:\d{2}/.test(t)) return t;
  }
  return null;
}

/** Istante di partenza della corsa nel giorno `date` (fuso del server). */
export function departureInstant(date: string, schedule: any): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ""));
  const t = /^(\d{1,2}):(\d{2})/.exec(scheduleDepartureTime(schedule) || "");
  if (!m || !t) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +t[1], +t[2], 0, 0);
}

/** true se la corsa del giorno `date` non e' piu' prenotabile. */
export function isPastBookingCutoff(date: string, schedule: any, cutoffMinutes: number, now: Date = new Date()): boolean {
  const departure = departureInstant(date, schedule);
  if (!departure) {
    // senza orario si chiude solo a giornata finita
    return date < localDate(now);
  }
  return departure.getTime() - cutoffMinutes * 60 * 1000 <= now.getTime();
}
