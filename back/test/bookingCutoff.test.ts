import { isPastBookingCutoff, scheduleDepartureTime, localDate } from "../src/utils/bookingCutoff";
import { sanitizeCutoffMinutes, sanitizeRefundCutoffDays, normalizeBookingSettings, isRefundAllowed } from "../src/utils/bookingSettings";

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

describe("bookingSettings", () => {
  it("normalizza documenti assenti o parziali con i default", () => {
    expect(normalizeBookingSettings(null)).toEqual({ bookingCutoffMinutes: 120, refundCutoffDays: 3 });
    expect(normalizeBookingSettings({ refundCutoffDays: 0 })).toEqual({ bookingCutoffMinutes: 120, refundCutoffDays: 0 });
    expect(sanitizeRefundCutoffDays(-1)).toBe(3);
    expect(sanitizeRefundCutoffDays("7")).toBe(7);
  });

  it("rimborso consentito fino a N giorni prima (stessa formula storica)", () => {
    const now = new Date(Date.UTC(2026, 10, 10, 12, 0));
    expect(isRefundAllowed("2026-11-14", 3, now)).toBe(true);
    expect(isRefundAllowed("2026-11-13", 3, now)).toBe(false);
    expect(isRefundAllowed("2026-11-11", 0, now)).toBe(true);
    expect(isRefundAllowed("2026-11-10", 0, now)).toBe(false);
  });
});
