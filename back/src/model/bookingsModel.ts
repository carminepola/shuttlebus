interface Bookings {
  bookingId: string;
  userId: string;
  scheduleId: string;
  boardingStopId: string; // Fermata di partenza scelta
  destinationStopId: string; // Fermata di arrivo scelta
  travelDate: string; // Data di partenza
  purchasedTickets: PurchasedTicket[]; // Biglietti acquistati con quantità, nome e prezzo
  luggageBooked: number; // Numero di bagagli prenotati
  status: "pending" | "confirmed" | "expired" | "cancelled" | "refunded"; // Stato della prenotazione
  totalPaid: number; // Prezzo totale pagato dall'utente
  createdAt: string; // Data e ora della prenotazione
  expirationTime?: string; // Tempo di scadenza se il pagamento non viene completato
}

interface PurchasedTicket {
  ticketTypeId: string; // ID del biglietto acquistato (riferito ai TicketType della Route)
  name: {
    it: string;
    en: string;
  }; // Nome del biglietto salvato nella prenotazione per evitare ricerche
  price: number; // Prezzo unitario al momento dell'acquisto
  quantity: number; // Numero di biglietti acquistati di questo tipo
}

export { Bookings, PurchasedTicket };
