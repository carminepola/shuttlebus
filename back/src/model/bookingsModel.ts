// import { stat } from "fs";
// import { Guid } from "guid-typescript";
// export default class Bookings {
//   bookingId: string;
//   userId: string;
//   scheduleId: string;
//   boardingStopId: string; // Fermata di partenza scelta
//   destinationStopId: string; // Fermata di arrivo scelta
//   travelDate: string; // Data di partenza
//   purchasedTickets: PurchasedTicket[]; // Biglietti acquistati con quantità, nome e prezzo
//   luggageBooked: number; // Numero di bagagli prenotati
//   status: "pending" | "confirmed" | "expired" | "cancelled" | "refunded"; // Stato della prenotazione
//   totalPaid: number; // Prezzo totale pagato dall'utente
//   createdAt: string; // Data e ora della prenotazione
//   updatedAt?: string;
//   expirationTime?: string; // Tempo di scadenza se il pagamento non viene completato
//   constructor(
//     userId: string,
//     scheduleId: string,
//     boardingStopId: string,
//     destinationStop: string,
//     travelDate: string,
//     purchasedTickets: PurchasedTicket[],
//     luggageBooked: number,
//     totalPaid: number,
//     status: "pending" | "confirmed" | "expired" | "cancelled" | "refunded"
//   ) {
//     this.bookingId = Guid.create().toString();
//     this.userId = userId;
//     this.scheduleId = scheduleId;
//     this.boardingStopId = boardingStopId;
//     this.destinationStopId = destinationStop;
//     this.travelDate = travelDate;
//     this.purchasedTickets = purchasedTickets;
//     this.luggageBooked = luggageBooked;
//     this.status = status ? status : "pending";
//     this.totalPaid = totalPaid;
//     this.createdAt = new Date().toISOString();
//     this.updatedAt = new Date().toISOString();
//     this.expirationTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
//   }
// }

// class PurchasedTicket {
//   ticketTypeId: string; // ID del biglietto acquistato (riferito ai TicketType della Route)
//   name: {
//     it: string;
//     en: string;
//   }; // Nome del biglietto salvato nella prenotazione per evitare ricerche
//   price: number; // Prezzo unitario al momento dell'acquisto
//   quantity: number; // Numero di biglietti acquistati di questo tipo
//   constructor(ticketTypeId: string, name: { it: string; en: string }, price: number, quantity: number) {
//     this.ticketTypeId = ticketTypeId;
//     this.name = name;
//     this.price = price;
//     this.quantity = quantity;
//   }
// }

// export { Bookings, PurchasedTicket };
