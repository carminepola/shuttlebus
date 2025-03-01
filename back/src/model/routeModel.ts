/** 📁 Modello per le fermate (Stop) */
interface Stop {
  id: string;
  name: {
    it: string;
    en: string;
  };
  position: number;
}

/** 📁 Modello per i tipi di biglietti (a livello di Route) */
interface TicketType {
  id: string;
  name: {
    it: string;
    en: string;
  };
  description: {
    it: string;
    en: string;
  };
  price: number;
}

/** 📁 Modello per la Tratta (Route) */
interface Route {
  id: string;
  name: {
    it: string;
    en: string;
  };
  stops: Stop[]; // Lista delle fermate
  ticketTypes: TicketType[]; // Tipologie di biglietti disponibili su questa tratta
}

/** 📁 Modello per le fermate della corsa (ScheduleStop) */
interface ScheduleStop {
  id: string;
  arrivalTime: string;
  departureTime?: string;
  status: "active" | "disabled"; // Permette di disattivare fermate senza eliminare la corsa
}

/** 📁 Modello per la Corsa (Schedule) */
interface Schedule {
  id: string;
  routeId: string; // Collegamento alla tratta (Route)
  startDate: string; // Data di inizio validità (YYYY-MM-DD)
  endDate: string; // Data di fine validità (YYYY-MM-DD)
  daysOfWeek: number[]; // Giorni della settimana in cui è attiva (1 = Lunedì, 7 = Domenica)
  departureTime: string; // Orario di partenza
  arrivalTime: string; // Orario di arrivo
  totalSeats: number; // Posti totali disponibili
  availableLuggage: number; // Bagagli opzionali disponibili
  stops: ScheduleStop[]; // Fermate della corsa con orari
  excludedDates: string[]; // Date in cui la corsa è disabilitata (YYYY-MM-DD)
  extraDates: string[]; // Date in cui la corsa è attiva anche se normalmente disabilitata
  status: "active" | "inactive" | "disabled"; // Stato della corsa
}

/** 📁 Modello per i biglietti acquistati in una prenotazione */
interface PurchasedTicket {
  ticketTypeId: string; // ID del biglietto acquistato (riferito ai TicketType della Route)
  name: {
    it: string;
    en: string;
  }; // Nome del biglietto salvato nella prenotazione per evitare ricerche
  price: number; // Prezzo unitario al momento dell'acquisto
  quantity: number; // Numero di biglietti acquistati di questo tipo
}

/** 📁 Modello per le Prenotazioni (Booking) */
interface Booking {
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

export { Stop, TicketType, Route, ScheduleStop, Schedule, PurchasedTicket, Booking };
