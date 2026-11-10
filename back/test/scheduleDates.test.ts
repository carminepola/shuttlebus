import { addDays, scheduleRunsOn, scheduleRunDates, scheduleServes } from "../src/utils/scheduleDates";

// 2026-11-10 e' martedi' (getDay 2), 2026-11-15 domenica (0)
const base = {
  status: "active",
  startDate: "2026-11-10",
  endDate: "2026-11-20",
  daysOfWeek: [0], // domenica esclusa
  excludedDates: ["2026-11-12"],
  extraDates: ["2026-12-25"],
  stops: [
    { id: "a", status: "active" },
    { id: "b", status: "disabled" },
    { id: "c", status: "active" },
  ],
};

describe("scheduleDates", () => {
  it("addDays attraversa mesi e anni", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
  });

  it("scheduleRunsOn: range, giorni esclusi, date escluse e extra", () => {
    expect(scheduleRunsOn(base, "2026-11-10")).toBe(true);
    expect(scheduleRunsOn(base, "2026-11-12")).toBe(false); // excludedDates
    expect(scheduleRunsOn(base, "2026-11-15")).toBe(false); // domenica esclusa
    expect(scheduleRunsOn(base, "2026-11-21")).toBe(false); // fuori range
    expect(scheduleRunsOn(base, "2026-12-25")).toBe(true); // extraDates
    expect(scheduleRunsOn({ ...base, status: "inactive" }, "2026-11-10")).toBe(false);
  });

  it("scheduleRunDates: ordinate e limitate all'intervallo", () => {
    expect(scheduleRunDates(base, "2026-11-11", "2026-11-16")).toEqual(["2026-11-11", "2026-11-13", "2026-11-14", "2026-11-16"]);
    expect(scheduleRunDates(base, "2026-11-21", "2027-01-01")).toEqual(["2026-12-25"]);
    expect(scheduleRunDates(base, "2027-01-01", "2027-02-01")).toEqual([]);
  });

  it("scheduleServes: fermate attive in ordine su route abilitata", () => {
    const route = { enabled: true, stops: [{ id: "a" }, { id: "b" }, { id: "c" }] };
    expect(scheduleServes(route, base, "a", "c")).toBe(true);
    expect(scheduleServes(route, base, "c", "a")).toBe(false);
    expect(scheduleServes(route, base, "a", "b")).toBe(false); // b disattivata
    expect(scheduleServes({ ...route, enabled: false }, base, "a", "c")).toBe(false);
  });
});
