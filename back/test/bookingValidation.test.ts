/**
 * Dati del biglietto che determinano prezzo e posti: corsa, fermate, quantita',
 * tipi di biglietto della corsa.
 */
import { validateBookingInput } from "../src/utils/bookingValidation";

const route = {
  enabled: true,
  ticketTypes: ["adulto", "bambino"],
  schedules: [
    {
      id: "s1",
      status: "active",
      stops: [
        { id: "NA", status: "active" },
        { id: "RM", status: "active" },
        { id: "FI", status: "disabled" },
        { id: "MI", status: "active" },
      ],
    },
    { id: "s2", status: "disabled", stops: [{ id: "NA", status: "active" }, { id: "MI", status: "active" }] },
  ],
};

function ticket(over: any = {}) {
  return {
    scheduleId: "s1",
    from: { id: "NA" },
    to: { id: "MI" },
    seats: 2,
    luggage: 1,
    ticketTypes: [
      { id: "adulto", count: 1 },
      { id: "bambino", count: 1 },
    ],
    ...over,
  };
}

describe("validateBookingInput", () => {
  it("accetta un viaggio valido", () => {
    expect(validateBookingInput(ticket(), route)).toBeNull();
    expect(validateBookingInput(ticket({ from: { id: "RM" }, to: { id: "MI" } }), route)).toBeNull();
  });

  it("rifiuta tratta disabilitata, corsa inesistente o disattivata", () => {
    expect(validateBookingInput(ticket(), { ...route, enabled: false })).toBe("str_error_time");
    expect(validateBookingInput(ticket(), null)).toBe("str_error_time");
    expect(validateBookingInput(ticket({ scheduleId: "nope" }), route)).toBe("str_error_time");
    expect(validateBookingInput(ticket({ scheduleId: "s2" }), route)).toBe("str_error_time");
    expect(validateBookingInput(ticket(), { ...route, schedules: undefined })).toBe("str_error_time");
  });

  it("rifiuta fermate estranee, disattivate, invertite o uguali", () => {
    expect(validateBookingInput(ticket({ to: { id: "XX" } }), route)).toBe("str_error_check_price");
    expect(validateBookingInput(ticket({ to: { id: "FI" } }), route)).toBe("str_error_check_price");
    expect(validateBookingInput(ticket({ from: { id: "MI" }, to: { id: "NA" } }), route)).toBe("str_error_check_price");
    expect(validateBookingInput(ticket({ from: { id: "RM" }, to: { id: "RM" } }), route)).toBe("str_error_check_price");
    expect(validateBookingInput(ticket({ from: undefined }), route)).toBe("str_error_check_price");
  });

  it("rifiuta quantita' negative, decimali o non numeriche", () => {
    const bad = [
      { ticketTypes: [{ id: "adulto", count: 3 }, { id: "bambino", count: -1 }] },
      { ticketTypes: [{ id: "adulto", count: 1.5 }, { id: "bambino", count: 0.5 }] },
      { ticketTypes: [{ id: "adulto", count: "2" }] },
      { luggage: -5 },
      { luggage: 0.5 },
      { seats: 0 },
      { seats: "2" },
      { ticketTypes: [] },
      { ticketTypes: [{ id: "adulto", count: 1 }, { id: "adulto", count: 1 }] },
    ];
    for (const b of bad) expect(validateBookingInput(ticket(b), route)).toBe("str_error_check_price");
  });

  it("rifiuta tipi di biglietto non associati alla corsa", () => {
    expect(validateBookingInput(ticket({ ticketTypes: [{ id: "senior", count: 2 }] }), route)).toBe("str_error_check_price");
    // con quantita' 0 non conta
    expect(validateBookingInput(ticket({ ticketTypes: [{ id: "adulto", count: 2 }, { id: "senior", count: 0 }] }), route)).toBeNull();
  });

  it("corsa senza tipi associati: tutti ammessi (dati storici)", () => {
    expect(validateBookingInput(ticket({ ticketTypes: [{ id: "senior", count: 2 }] }), { ...route, ticketTypes: [] })).toBeNull();
  });
});
