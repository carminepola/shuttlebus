/**
 * Andata e ritorno: il ritorno deve partire un giorno successivo all'andata, oppure
 * lo stesso giorno non prima dell'arrivo dell'andata. Orari presi dalle corse su DB
 * (fermata di arrivo dell'andata, fermata di partenza del ritorno).
 */

const toMinutes = (t?: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
  return m ? +m[1] * 60 + +m[2] : null;
};

function stopTime(route: any, scheduleId: string, stopId: string): string | undefined {
  const schedule = (route?.schedules || []).find((s: any) => s.id === scheduleId);
  return (schedule?.stops || []).find((s: any) => s.id === stopId)?.stopTime;
}

/** true se le due tratte si possono abbinare. */
export function isRoundTripCompatible(outbound: any, outboundRoute: any, ret: any, returnRoute: any): boolean {
  if (typeof outbound?.date !== "string" || typeof ret?.date !== "string") return false;
  if (ret.date !== outbound.date) return ret.date > outbound.date;
  const arrival = toMinutes(stopTime(outboundRoute, outbound.scheduleId, outbound.to?.id));
  const departure = toMinutes(stopTime(returnRoute, ret.scheduleId, ret.from?.id));
  if (arrival === null || departure === null) return false;
  return departure >= arrival;
}
