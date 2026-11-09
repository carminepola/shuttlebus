/**
 * Tariffe per tratta: prezzo per coppia di fermate (from -> to) e tipo di biglietto.
 * Senza tariffa vale il `cost` del ticket type. Stessa logica di back/src/utils/fares.ts,
 * che resta l'unica fonte di verita' sul prezzo addebitato.
 */
export interface Fare {
  fromStopId: string;
  toStopId: string;
  prices: Record<string, number>;
}

export function resolveFarePrice(route: any, fromStopId: string, toStopId: string, ticketType: any): number {
  const fares: Fare[] = Array.isArray(route?.fares) ? route.fares : [];
  const fare = fares.find((f) => f.fromStopId === fromStopId && f.toStopId === toStopId);
  const price = fare?.prices?.[ticketType.id];
  return typeof price === 'number' && Number.isFinite(price) && price >= 0 ? price : ticketType.cost;
}
