/**
 * Date "YYYY-MM-DD" in ora locale. new Date('YYYY-MM-DD') e toISOString() lavorano
 * in UTC: in Italia tra mezzanotte e le 2 davano il giorno sbagliato.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Data locale "YYYY-MM-DD". */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const localToday = () => localDate();

/** "YYYY-MM-DD" + n giorni. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + n));
}

/** Data "YYYY-MM-DD" come Date a mezzanotte locale (per le pipe date). */
export function parseLocalDate(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

/**
 * Rimborso consentito fino al giorno prima di (data corsa - N giorni), come nel back
 * (utils/bookingSettings.isRefundAllowed): con N = 3 e corsa il 14, fino al 10 compreso.
 */
export function isRefundAllowed(travelDate: string, days: number): boolean {
  return !!parseLocalDate(travelDate) && localToday() < addDays(travelDate, -days);
}

/** Ultimo giorno in cui il rimborso e' possibile. */
export function refundLastDay(travelDate: string, days: number): Date | null {
  return parseLocalDate(travelDate) ? parseLocalDate(addDays(travelDate, -days - 1)) : null;
}
