/**
 * Biglietto come documento fiscale: scorporo IVA, numerazione, impostazioni e
 * report dei corrispettivi per il commercialista (funzioni pure, senza Mongo).
 */
import { buildFiscalDoc, buildFiscalReport, fiscalCode, missingFiscalFields, normalizeFiscalSettings, refundsOf, splitVat } from "../src/utils/fiscal";

const SETTINGS = normalizeFiscalSettings({ legalName: "Bus Srl", vatNumber: "01234567890", taxCode: "", address: "Via Roma 1, Napoli", vatRate: 10, vatNote: "" });

function sold(n: number, date: string, total: number, extra: any = {}) {
  const issuedAt = new Date(`${date}T10:00:00`);
  const book: any = { numberOfTickets: `SB${n}`, status: "confirmed", total, paymentMethod: "stripe", date: "2030-01-01", name: { it: "Linea" }, user: { name: "Mario" }, ...extra };
  book.fiscal = buildFiscalDoc(book, SETTINGS, n, issuedAt);
  return book;
}

describe("splitVat", () => {
  test("imponibile + IVA = totale, in centesimi", () => {
    expect(splitVat(11, 10)).toEqual({ total: 11, taxable: 10, vat: 1 });
    const s = splitVat(25.5, 10);
    expect(s.taxable).toBe(23.18);
    expect(s.vat).toBe(2.32);
    expect(Math.round((s.taxable + s.vat) * 100)).toBe(2550);
  });
  test("aliquota 0: tutto imponibile", () => {
    expect(splitVat(12.3, 0)).toEqual({ total: 12.3, taxable: 12.3, vat: 0 });
  });
});

describe("impostazioni fiscali", () => {
  test("campi obbligatori mancanti", () => {
    expect(missingFiscalFields(normalizeFiscalSettings({ legalName: "X", vatNumber: "", address: "" }))).toEqual(["vatNumber", "address"]);
    expect(missingFiscalFields(SETTINGS)).toEqual([]);
  });
  test("aliquota non valida -> default", () => {
    expect(normalizeFiscalSettings({ vatRate: -1 }).vatRate).toBe(10);
    expect(normalizeFiscalSettings({ vatRate: 0 }).vatRate).toBe(0);
    expect(normalizeFiscalSettings({ vatRate: 5 }).vatRate).toBe(5);
  });
});

describe("documento fiscale", () => {
  test("numero annuale, data di emissione, dati emittente e metodo", () => {
    const b = sold(7, "2026-11-25", 22);
    expect(b.fiscal.code).toBe("2026/000007");
    expect(b.fiscal.date).toBe("2026-11-25");
    expect(b.fiscal.vatNumber).toBe("01234567890");
    expect(b.fiscal).toMatchObject({ total: 22, taxable: 20, vat: 2, vatRate: 10, paymentMethod: "stripe" });
    expect(fiscalCode(2027, 1)).toBe("2027/000001");
  });
});

describe("rimborsi", () => {
  test("storico + differenza per i rimborsi senza storico", () => {
    const b = sold(1, "2026-11-01", 30, { status: "refunded", refunds: [{ at: Date.parse("2026-11-02T09:00:00"), amount: 10 }], refundedAt: Date.parse("2026-11-03T09:00:00") });
    expect(refundsOf(b).map((r) => r.amount)).toEqual([10, 20]);
  });
  test("rimborso parziale con biglietto ancora valido: solo lo storico", () => {
    const b = sold(1, "2026-11-01", 30, { refunds: [{ at: Date.parse("2026-11-02T09:00:00"), amount: 10 }] });
    expect(refundsOf(b).map((r) => r.amount)).toEqual([10]);
  });
});

describe("report corrispettivi", () => {
  const books = [
    sold(1, "2026-10-31", 11), // fuori periodo, rimborsato nel periodo
    sold(2, "2026-11-01", 22),
    sold(3, "2026-11-01", 11, { paymentMethod: "cash" }),
    sold(4, "2026-11-02", 33),
    sold(5, "2026-12-01", 11), // dopo il periodo
  ];
  books[0].status = "refunded";
  books[0].refundedAt = Date.parse("2026-11-02T12:00:00");

  const r = buildFiscalReport(books, "2026-11-01", "2026-11-30");

  test("vendite per giorno di emissione, con primo e ultimo numero", () => {
    expect(r.days.map((d) => [d.date, d.count, d.gross])).toEqual([
      ["2026-11-01", 2, 33],
      ["2026-11-02", 1, 33],
    ]);
    expect(r.days[0].firstCode).toBe("2026/000002");
    expect(r.days[0].lastCode).toBe("2026/000003");
    expect(r.days[0].byMethod).toEqual({ stripe: 22, cash: 11 });
  });

  test("rimborsi nel giorno del rimborso, anche di biglietti emessi prima", () => {
    expect(r.refunds).toHaveLength(1);
    expect(r.refunds[0]).toMatchObject({ date: "2026-11-02", code: "2026/000001", amount: 11, taxable: 10, vat: 1 });
    expect(r.days[1]).toMatchObject({ refunds: 11, net: 22 });
  });

  test("totali, per metodo e per aliquota", () => {
    expect(r.totals).toMatchObject({ count: 3, gross: 66, taxable: 60, vat: 6, refunds: 11, net: 55, netTaxable: 50, netVat: 5 });
    expect(r.byMethod.cash.gross).toBe(11);
    expect(r.byVatRate["10"].gross).toBe(66);
    expect(r.tickets.map((t) => t.code)).toEqual(["2026/000002", "2026/000003", "2026/000004"]);
  });
});
