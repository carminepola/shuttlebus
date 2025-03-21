/** 📁 Modello per le fermate (Stop) */
interface Stop {
  id: string;
  position: number;
}

/** 📁 Modello per la Tratta (Route) */
interface Route {
  id: string;
  name: {
    it: string;
    en: string;
  };
  stops: Stop[]; // Lista delle fermate
  ticketTypes: string[];
  enabled: boolean; // Tipologie di biglietti disponibili su questa tratta
}

/** 📁 Modello per le fermate della corsa (ScheduleStop) */
interface ScheduleStop {
  id: string;
  stopTime?: string;
  status: "active" | "disabled" | "deleted"; // Permette di disattivare fermate senza eliminare la corsa
}

/** 📁 Modello per la Corsa (Schedule) */
interface Schedule {
  id: string;
  routeId: string; // Collegamento alla tratta (Route)
  startDate: string; // Data di inizio validità (YYYY-MM-DD)
  endDate: string; // Data di fine validità (YYYY-MM-DD)
  daysOfWeek: number[]; // Giorni della settimana in cui è attiva (1 = Lunedì, 7 = Domenica)
  totalSeats: number; // Posti totali disponibili
  availableLuggage: number; // Bagagli opzionali disponibili
  stops: ScheduleStop[]; // Fermate della corsa con orari
  excludedDates: string[]; // Date in cui la corsa è disabilitata (YYYY-MM-DD)
  extraDates: string[]; // Date in cui la corsa è attiva anche se normalmente disabilitata
  status: "active" | "disabled" | "deleted"; // Stato della corsa
  busId: string;
}

export { Stop, Route, ScheduleStop, Schedule };
