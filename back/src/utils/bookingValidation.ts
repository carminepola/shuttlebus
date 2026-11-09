/**
 * Controlli sui dati del biglietto che determinano prezzo e posti. I dati arrivano
 * dal client: prima di calcolare il prezzo verifichiamo che descrivano un viaggio
 * reale su quella corsa. Restituisce la chiave di errore o null se e' tutto valido.
 */

const isCount = (v: any) => Number.isInteger(v) && v >= 0;

export function validateBookingInput(ticket: any, route: any): string | null {
  if (!route || !route.enabled) return "str_error_time";

  // corsa esistente e attiva
  const schedule = (Array.isArray(route.schedules) ? route.schedules : []).find((s: any) => s.id === ticket?.scheduleId);
  if (!schedule || schedule.status !== "active") return "str_error_time";

  // fermate: della corsa, attive, partenza prima dell'arrivo
  // (stesso ordine usato dal calcolo dei posti: schedule.stops)
  const stops: any[] = Array.isArray(schedule.stops) ? schedule.stops : [];
  const fromIdx = stops.findIndex((s) => s.id === ticket?.from?.id && s.status === "active");
  const toIdx = stops.findIndex((s) => s.id === ticket?.to?.id && s.status === "active");
  if (fromIdx < 0 || toIdx < 0 || fromIdx >= toIdx) return "str_error_check_price";

  // quantita': interi non negativi, almeno un posto
  if (!Number.isInteger(ticket.seats) || ticket.seats < 1) return "str_error_check_price";
  if (!isCount(ticket.luggage)) return "str_error_check_price";
  if (!Array.isArray(ticket.ticketTypes) || ticket.ticketTypes.length === 0) return "str_error_check_price";
  const seen = new Set<string>();
  for (const t of ticket.ticketTypes) {
    if (!t || typeof t.id !== "string" || !isCount(t.count)) return "str_error_check_price";
    if (seen.has(t.id)) return "str_error_check_price"; // stesso tipo ripetuto
    seen.add(t.id);
  }

  // tipi di biglietto associati alla corsa (corse senza associazioni: tutti ammessi)
  const allowed: string[] = Array.isArray(route.ticketTypes) ? route.ticketTypes : [];
  if (allowed.length > 0 && ticket.ticketTypes.some((t: any) => t.count > 0 && !allowed.includes(t.id))) {
    return "str_error_check_price";
  }
  return null;
}
