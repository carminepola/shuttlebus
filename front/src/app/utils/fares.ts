/**
 * Tariffe per tratta: prezzo per coppia di fermate (from -> to) e tipo di biglietto.
 * Senza tariffa vale il `cost` del ticket type. Stessa logica di back/src/utils/fares.ts,
 * che resta l'unica fonte di verita' sul prezzo addebitato.
 */
import { LUGGAGE_PRICE } from '../constants/app.constants';

/** Prezzo del bagaglio opzionale della corsa (stessa logica del back); assente = LUGGAGE_PRICE. */
export function resolveLuggagePrice(schedule: any): number {
  const p = schedule?.luggagePrice;
  return typeof p === 'number' && Number.isFinite(p) && p >= 0 ? p : LUGGAGE_PRICE;
}

/** Prezzo bagaglio salvato sul biglietto (biglietti vecchi: LUGGAGE_PRICE). */
export function bookingLuggagePrice(booking: any): number {
  return typeof booking?.luggagePrice === 'number' ? booking.luggagePrice : LUGGAGE_PRICE;
}

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
