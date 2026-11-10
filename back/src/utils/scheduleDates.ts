/**
 * Giorni in cui gira una corsa (Schedule), con la stessa logica della ricerca
 * (bookingsDao.findAvailableRoutes):
 * - extraDates: la corsa gira in quel giorno comunque;
 * - altrimenti deve essere tra startDate ed endDate, non in excludedDates e il
 *   giorno della settimana NON deve essere in daysOfWeek (giorni esclusi,
 *   convenzione getDay: 0 = domenica ... 6 = sabato).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Orizzonte massimo in cui cercare la prossima corsa (giorni). */
export const MAX_LOOKAHEAD_DAYS = 366;

export function isDateString(v: any): v is string {
  return typeof v === "string" && DATE_RE.test(v);
}

/** "YYYY-MM-DD" + n giorni (calcolo in UTC: niente sorprese con l'ora legale). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const list = (v: any): any[] => (Array.isArray(v) ? v : []);

export function scheduleRunsOn(schedule: any, date: string): boolean {
  if (!schedule || schedule.status !== "active" || !isDateString(date)) return false;
  if (list(schedule.extraDates).includes(date)) return true;
  if (!isDateString(schedule.startDate) || !isDateString(schedule.endDate)) return false;
  if (date < schedule.startDate || date > schedule.endDate) return false;
  if (list(schedule.excludedDates).includes(date)) return false;
  return !list(schedule.daysOfWeek).includes(weekday(date));
}

/** Giorni (ordinati) da `from` a `to` compresi in cui la corsa gira. */
export function scheduleRunDates(schedule: any, from: string, to: string): string[] {
  if (!schedule || schedule.status !== "active" || from > to) return [];
  const out = new Set<string>();
  for (const d of list(schedule.extraDates)) {
    if (isDateString(d) && d >= from && d <= to) out.add(d);
  }
  if (isDateString(schedule.startDate) && isDateString(schedule.endDate)) {
    const start = schedule.startDate > from ? schedule.startDate : from;
    const end = schedule.endDate < to ? schedule.endDate : to;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (scheduleRunsOn(schedule, d)) out.add(d);
    }
  }
  return [...out].sort();
}

/** Fermate attive della corsa, nell'ordine di percorrenza. */
export function activeStopIds(schedule: any): string[] {
  return list(schedule?.stops)
    .filter((s: any) => s && s.status === "active" && typeof s.id === "string")
    .map((s: any) => s.id);
}

/** La corsa serve from -> to (entrambe attive, partenza prima dell'arrivo) su una route abilitata. */
export function scheduleServes(route: any, schedule: any, fromStopId: string, toStopId: string): boolean {
  if (!route?.enabled) return false;
  const routeStops = list(route.stops).map((s: any) => s?.id);
  if (!routeStops.includes(fromStopId) || !routeStops.includes(toStopId)) return false;
  const stops = activeStopIds(schedule);
  const a = stops.indexOf(fromStopId);
  const b = stops.indexOf(toStopId);
  return a >= 0 && b >= 0 && a < b;
}
