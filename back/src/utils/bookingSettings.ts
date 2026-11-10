/**
 * Impostazioni delle prenotazioni (collection bookingSettings, documento id "default"),
 * modificabili da Impostazioni -> Prenotazioni:
 * - bookingCutoffMinutes: vendite online chiuse N minuti prima della partenza
 *   (120 = due ore prima, 1440 = il giorno prima alla stessa ora, 0 = fino alla partenza);
 * - refundCutoffDays: rimborso dal cliente possibile fino a N giorni prima della corsa.
 */

export const DEFAULT_BOOKING_CUTOFF_MINUTES = 120;
export const MAX_BOOKING_CUTOFF_MINUTES = 60 * 24 * 30;
export const DEFAULT_REFUND_CUTOFF_DAYS = 3;
export const MAX_REFUND_CUTOFF_DAYS = 365;

export interface BookingSettings {
  bookingCutoffMinutes: number;
  refundCutoffDays: number;
}

function intInRange(value: any, max: number): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

/** Valore valido o default (0 ammesso). */
export function sanitizeCutoffMinutes(value: any): number {
  return intInRange(value, MAX_BOOKING_CUTOFF_MINUTES) ?? DEFAULT_BOOKING_CUTOFF_MINUTES;
}

export function sanitizeRefundCutoffDays(value: any): number {
  return intInRange(value, MAX_REFUND_CUTOFF_DAYS) ?? DEFAULT_REFUND_CUTOFF_DAYS;
}

/** Impostazioni complete da un documento (anche assente o parziale). */
export function normalizeBookingSettings(doc: any): BookingSettings {
  return {
    bookingCutoffMinutes: sanitizeCutoffMinutes(doc?.bookingCutoffMinutes ?? process.env.DEFAULT_BOOKING_CUTOFF_MINUTES),
    refundCutoffDays: sanitizeRefundCutoffDays(doc?.refundCutoffDays ?? process.env.DEFAULT_REFUND_CUTOFF_DAYS),
  };
}

/**
 * Il cliente puo' chiedere il rimborso solo fino a `days` giorni prima della corsa
 * (stessa formula usata finora con 3 giorni: data della corsa - N giorni >= adesso).
 */
export function isRefundAllowed(travelDate: string, days: number, now: Date = new Date()): boolean {
  return new Date(travelDate).getTime() - days * 24 * 60 * 60 * 1000 >= now.getTime();
}
