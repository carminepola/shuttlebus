/**
 * Giorni di validita' dei tipi di biglietto (1 = lunedi' ... 7 = domenica).
 */
import { isoWeekday, isTicketTypeValidOn, sanitizeDaysOfWeek } from "../src/utils/ticketDays";

describe("isoWeekday", () => {
  it("restituisce il giorno ISO della data", () => {
    expect(isoWeekday("2026-11-09")).toBe(1); // lunedi'
    expect(isoWeekday("2026-11-10")).toBe(2); // martedi'
    expect(isoWeekday("2026-11-14")).toBe(6); // sabato
    expect(isoWeekday("2026-11-15")).toBe(7); // domenica
  });

  it("rifiuta formati non validi", () => {
    expect(isoWeekday("")).toBeNull();
    expect(isoWeekday("10/11/2026")).toBeNull();
  });
});

describe("isTicketTypeValidOn", () => {
  const weekend = { id: "weekend", daysOfWeek: [6, 7] };
  const over60 = { id: "over60", daysOfWeek: [2] };

  it("limita il biglietto ai giorni configurati", () => {
    expect(isTicketTypeValidOn(weekend, "2026-11-14")).toBe(true);
    expect(isTicketTypeValidOn(weekend, "2026-11-15")).toBe(true);
    expect(isTicketTypeValidOn(weekend, "2026-11-13")).toBe(false);
    expect(isTicketTypeValidOn(over60, "2026-11-10")).toBe(true);
    expect(isTicketTypeValidOn(over60, "2026-11-11")).toBe(false);
  });

  it("senza giorni il biglietto vale sempre", () => {
    expect(isTicketTypeValidOn({ id: "adulto" }, "2026-11-11")).toBe(true);
    expect(isTicketTypeValidOn({ id: "adulto", daysOfWeek: [] }, "2026-11-11")).toBe(true);
  });

  it("con restrizione e data non valida rifiuta", () => {
    expect(isTicketTypeValidOn(over60, "boh")).toBe(false);
  });
});

describe("sanitizeDaysOfWeek", () => {
  it("tiene interi 1..7 unici e ordinati", () => {
    expect(sanitizeDaysOfWeek([7, "6", 6, 0, 8, 2.5, "x", null])).toEqual([6, 7]);
  });

  it("tutti i giorni equivale a nessuna restrizione", () => {
    expect(sanitizeDaysOfWeek([1, 2, 3, 4, 5, 6, 7])).toEqual([]);
  });

  it("input non array -> nessuna restrizione", () => {
    expect(sanitizeDaysOfWeek(undefined)).toEqual([]);
    expect(sanitizeDaysOfWeek("6,7")).toEqual([]);
  });
});
