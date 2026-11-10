import { isPastBookingCutoff, sanitizeCutoffMinutes, scheduleDepartureTime, localDate } from "../src/utils/bookingCutoff";

const schedule = { departureTime: "10:00", stops: [{ id: "a", stopTime: "10:00" }] };
const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi);

describe("bookingCutoff", () => {
  it("sanitizeCutoffMinutes: default sui valori non validi, 0 ammesso", () => {
    expect(sanitizeCutoffMinutes(undefined)).toBe(120);
    expect(sanitizeCutoffMinutes(-5)).toBe(120);
    expect(sanitizeCutoffMinutes(1.5)).toBe(120);
    expect(sanitizeCutoffMinutes(0)).toBe(0);
    expect(sanitizeCutoffMinutes("1440")).toBe(1440);
  });

  it("orario di partenza: departureTime o prima fermata", () => {
    expect(scheduleDepartureTime(schedule)).toBe("10:00");
    expect(scheduleDepartureTime({ stops: [{ stopTime: "" }, { stopTime: "07:30" }] })).toBe("07:30");
    expect(scheduleDepartureTime({})).toBeNull();
  });

  it("stesso giorno: chiusa a meno di N minuti dalla partenza", () => {
    expect(isPastBookingCutoff("2026-11-10", schedule, 120, at(2026, 11, 10, 7, 59))).toBe(false);
    expect(isPastBookingCutoff("2026-11-10", schedule, 120, at(2026, 11, 10, 8, 0))).toBe(true);
    expect(isPastBookingCutoff("2026-11-10", schedule, 0, at(2026, 11, 10, 9, 59))).toBe(false);
  });

  it("il giorno prima: 1440 minuti chiude alla stessa ora del giorno precedente", () => {
    expect(isPastBookingCutoff("2026-11-11", schedule, 1440, at(2026, 11, 10, 9, 59))).toBe(false);
    expect(isPastBookingCutoff("2026-11-11", schedule, 1440, at(2026, 11, 10, 10, 0))).toBe(true);
  });

  it("date passate sempre chiuse, anche senza orario", () => {
    expect(isPastBookingCutoff("2026-11-09", schedule, 0, at(2026, 11, 10, 0, 0))).toBe(true);
    expect(isPastBookingCutoff("2026-11-09", {}, 0, at(2026, 11, 10, 0, 0))).toBe(true);
    expect(isPastBookingCutoff("2026-11-10", {}, 0, at(2026, 11, 10, 23, 0))).toBe(false);
  });

  it("localDate nel fuso locale", () => {
    expect(localDate(at(2026, 1, 5, 23, 30))).toBe("2026-01-05");
  });
});
