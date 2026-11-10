/**
 * Tariffe per tratta: prezzo per coppia di fermate con fallback al cost del ticket type.
 */
import { resolveFarePrice, sanitizeFares } from "../src/utils/fares";

const stops = [{ id: "NA" }, { id: "RM" }, { id: "FI" }, { id: "MI" }];
const adulto = { id: "adulto", cost: 100 };
const bambino = { id: "bambino", cost: 60 };

const route = {
  stops,
  fares: [
    { fromStopId: "NA", toStopId: "RM", prices: { adulto: 50, bambino: 25 } },
    { fromStopId: "NA", toStopId: "FI", prices: { adulto: 70 } },
    { fromStopId: "NA", toStopId: "MI", prices: { adulto: 100, bambino: 60 } },
  ],
};

describe("resolveFarePrice", () => {
  it("usa la tariffa della coppia di fermate", () => {
    expect(resolveFarePrice(route, "NA", "RM", adulto)).toBe(50);
    expect(resolveFarePrice(route, "NA", "FI", adulto)).toBe(70);
    expect(resolveFarePrice(route, "NA", "RM", bambino)).toBe(25);
  });

  it("ricade sul cost del ticket type se la cella manca", () => {
    expect(resolveFarePrice(route, "NA", "FI", bambino)).toBe(60);
    expect(resolveFarePrice(route, "RM", "MI", adulto)).toBe(100);
    expect(resolveFarePrice({ stops }, "NA", "RM", adulto)).toBe(100);
    expect(resolveFarePrice(null, "NA", "RM", adulto)).toBe(100);
  });

  it("e' direzionale: la tratta inversa non eredita la tariffa", () => {
    expect(resolveFarePrice(route, "RM", "NA", adulto)).toBe(100);
  });

  it("ignora prezzi non validi salvati su DB", () => {
    const bad = { fares: [{ fromStopId: "NA", toStopId: "RM", prices: { adulto: -5, bambino: "10" } }] };
    expect(resolveFarePrice(bad, "NA", "RM", adulto)).toBe(100);
    expect(resolveFarePrice(bad, "NA", "RM", bambino)).toBe(60);
  });
});

describe("sanitizeFares", () => {
  const types = ["adulto", "bambino"];

  it("tiene solo coppie valide in ordine di percorrenza", () => {
    const out = sanitizeFares(
      [
        { fromStopId: "NA", toStopId: "RM", prices: { adulto: 50 } },
        { fromStopId: "MI", toStopId: "NA", prices: { adulto: 10 } }, // ordine inverso
        { fromStopId: "NA", toStopId: "XX", prices: { adulto: 10 } }, // fermata estranea
        { fromStopId: "RM", toStopId: "RM", prices: { adulto: 10 } }, // stessa fermata
        { fromStopId: "NA", toStopId: "RM", prices: { adulto: 1 } }, // duplicato
      ],
      stops,
      types,
    );
    expect(out).toEqual([{ fromStopId: "NA", toStopId: "RM", prices: { adulto: 50 } }]);
  });

  it("normalizza i prezzi e scarta tipi non associati alla route", () => {
    const out = sanitizeFares(
      [{ fromStopId: "NA", toStopId: "FI", prices: { adulto: "70.555", bambino: "", senior: 10, altro: -1 } }],
      stops,
      types,
    );
    expect(out).toEqual([{ fromStopId: "NA", toStopId: "FI", prices: { adulto: 70.56 } }]);
  });

  it("scarta coppie senza prezzi e input non array", () => {
    expect(sanitizeFares([{ fromStopId: "NA", toStopId: "FI", prices: {} }], stops, types)).toEqual([]);
    expect(sanitizeFares("x", stops, types)).toEqual([]);
    expect(sanitizeFares(undefined, stops, types)).toEqual([]);
  });
});

import { resolveLuggagePrice, sanitizeLuggagePrice } from "../src/utils/fares";

describe("prezzo bagaglio per corsa", () => {
  it("usa il prezzo della corsa o, se assente/non valido, quello di default", () => {
    expect(resolveLuggagePrice({ luggagePrice: 3.5 })).toBe(3.5);
    expect(resolveLuggagePrice({ luggagePrice: 0 })).toBe(0);
    expect(resolveLuggagePrice({})).toBe(2);
    expect(resolveLuggagePrice({ luggagePrice: -1 })).toBe(2);
    expect(resolveLuggagePrice(undefined)).toBe(2);
  });

  it("sanitizeLuggagePrice: numeri >= 0 arrotondati al centesimo", () => {
    expect(sanitizeLuggagePrice("4.999")).toBe(5);
    expect(sanitizeLuggagePrice(2.345)).toBe(2.35);
    expect(sanitizeLuggagePrice(-1)).toBeNull();
    expect(sanitizeLuggagePrice("abc")).toBeNull();
  });
});
