/**
 * All'acquisto il server controlla che ogni biglietto sia valido nel giorno della
 * corsa (es. Over 60 solo martedi' e mercoledi'), con i dati che arrivano dal DAO reale.
 */
jest.mock("../src/index", () => ({
  client: {},
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  env: {},
  db: undefined,
  restServer: { isServerRunning: () => false },
  mailConfig: undefined,
}));
jest.mock("../src/stripe", () => ({ __esModule: true, default: { getInstance: () => ({}) } }));

import BookingsServices from "../src/components/services/bookingServices";
import TicketTypeDao from "../src/components/dao/ticketTypeDao";

// documenti come nel DB: il DAO reale ne restituisce solo i campi proiettati
const TICKET_TYPES = [
  { id: "adulti", name: { it: "Adulti" }, cost: 20, isActive: true, isDeleted: false, secret: "x" },
  { id: "over60", name: { it: "Over 60" }, cost: 12, daysOfWeek: [2, 3], showOnHome: false, isActive: true, isDeleted: false },
];

function projected(p: Record<string, number>) {
  return TICKET_TYPES.map((d: any) => Object.fromEntries(Object.keys(p).filter((k) => p[k] && k in d).map((k) => [k, d[k]])));
}

const ROUTE = {
  id: "r",
  enabled: true,
  stops: [{ id: "NA" }, { id: "MI" }],
  ticketTypes: [],
  schedules: [{ id: "s", status: "active", departureTime: "10:00", availableLuggage: 5, stops: [{ id: "NA", status: "active", stopTime: "10:00" }, { id: "MI", status: "active", stopTime: "16:00" }] }],
};

function makeService() {
  const s: any = new BookingsServices({ collection: () => ({}) } as any);
  const daoDb: any = { collection: () => ({ find: () => ({ project: (p: any) => ({ toArray: async () => projected(p) }) }) }) };
  s.ticketTypeServices = { getAllActiveTicketTypes: () => new TicketTypeDao(daoDb).getAllActiveTicketType() };
  s.routeServices = { getRouteById: async () => ROUTE };
  s.bookingSettingsServices = { get: async () => ({ bookingCutoffMinutes: 120, refundCutoffDays: 3 }) };
  return s;
}

const ticket = (date: string, id: string, cost: number) => ({
  date,
  routeId: "r",
  scheduleId: "s",
  from: { id: "NA" },
  to: { id: "MI" },
  seats: 1,
  luggage: 0,
  total: cost,
  ticketTypes: [{ id, count: 1, cost }],
});

describe("validita' del biglietto nel giorno, all'acquisto", () => {
  it("Over 60 il lunedi' viene rifiutato", async () => {
    await expect(makeService().checkPriceAndTime(ticket("2030-01-07", "over60", 12))).rejects.toMatchObject({ message: "str_error_check_price" });
  });

  it("Over 60 il martedi' viene accettato", async () => {
    await expect(makeService().checkPriceAndTime(ticket("2030-01-08", "over60", 12))).resolves.toBe(true);
  });

  it("biglietto senza restrizioni valido tutti i giorni", async () => {
    await expect(makeService().checkPriceAndTime(ticket("2030-01-07", "adulti", 20))).resolves.toBe(true);
  });
});
