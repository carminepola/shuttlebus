/**
 * Giorni di validita' dei tipi di biglietto: 1 = lunedi' ... 7 = domenica,
 * lista vuota = tutti i giorni. Stessa logica di back/src/utils/ticketDays.ts,
 * che resta il controllo definitivo.
 */
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 7];

export function isoWeekday(date: string | undefined): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return d === 0 ? 7 : d;
}

export function isTicketTypeValidOn(ticketType: any, date: string | undefined): boolean {
  const days: number[] = Array.isArray(ticketType?.daysOfWeek) ? ticketType.daysOfWeek : [];
  if (days.length === 0) return true;
  const day = isoWeekday(date);
  return day !== null && days.includes(day);
}

/** Nome breve del giorno ISO nella lingua richiesta (1 gen 2024 era lunedi'). */
export function weekdayName(day: number, locale = 'it', style: 'short' | 'long' = 'short'): string {
  const date = new Date(Date.UTC(2024, 0, day));
  try {
    return new Intl.DateTimeFormat(locale, { weekday: style, timeZone: 'UTC' }).format(date);
  } catch {
    return new Intl.DateTimeFormat('it', { weekday: style, timeZone: 'UTC' }).format(date);
  }
}

/** "sab, dom" oppure "" se il biglietto vale tutti i giorni. */
export function daysLabel(days: number[] | undefined, locale = 'it'): string {
  if (!Array.isArray(days) || days.length === 0) return '';
  return days.map((d) => weekdayName(d, locale)).join(', ');
}
