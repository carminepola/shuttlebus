import { Fare } from "../model/routesModel";

/**
 * Tariffe per tratta (origine -> destinazione). Ogni coppia di fermate della Route
 * puo' avere un prezzo per tipo di biglietto; se la cella manca vale il `cost`
 * del ticket type (comportamento storico, nessuna migrazione necessaria).
 */

const MAX_PRICE = 100000;

function isValidPrice(v: any): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_PRICE;
}

/** Prezzo unitario di un ticket type sulla tratta from -> to della route. */
// route e ticketType arrivano come documenti Mongo non tipizzati
export function resolveFarePrice(route: any, fromStopId: string | undefined, toStopId: string | undefined, ticketType: any): number {
  const fares: Fare[] = Array.isArray(route?.fares) ? route.fares : [];
  const fare = fares.find((f) => f.fromStopId === fromStopId && f.toStopId === toStopId);
  const price = fare?.prices?.[ticketType.id];
  return isValidPrice(price) ? price : ticketType.cost;
}

/**
 * Normalizza le tariffe arrivate dall'admin: tiene solo coppie di fermate della
 * route in ordine di percorrenza, prezzi numerici >= 0 arrotondati al centesimo
 * e ticket type associati alla route. Le coppie senza prezzi vengono scartate.
 */
export function sanitizeFares(fares: any, stops: { id: string }[] = [], ticketTypes: string[] = []): Fare[] {
  if (!Array.isArray(fares)) return [];
  const index = new Map(stops.map((s, i) => [s.id, i]));
  const allowedTypes = new Set(ticketTypes);
  const seen = new Set<string>();
  const out: Fare[] = [];
  for (const f of fares) {
    if (!f || typeof f.fromStopId !== "string" || typeof f.toStopId !== "string") continue;
    const from = index.get(f.fromStopId);
    const to = index.get(f.toStopId);
    if (from === undefined || to === undefined || from >= to) continue;
    const key = `${f.fromStopId}|${f.toStopId}`;
    if (seen.has(key)) continue;
    const prices: Record<string, number> = {};
    if (f.prices && typeof f.prices === "object") {
      for (const [typeId, raw] of Object.entries(f.prices)) {
        if (!allowedTypes.has(typeId)) continue;
        const value = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
        if (isValidPrice(value)) prices[typeId] = Math.round(value * 100) / 100;
      }
    }
    if (Object.keys(prices).length === 0) continue;
    seen.add(key);
    out.push({ fromStopId: f.fromStopId, toStopId: f.toStopId, prices });
  }
  return out;
}
