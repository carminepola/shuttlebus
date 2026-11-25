import { localDate } from "./bookingCutoff";

/**
 * Dati fiscali dei biglietti (DPR 696/1996: il biglietto di trasporto pubblico
 * collettivo assolve la funzione dello scontrino se riporta i dati dell'emittente
 * e il corrispettivo). Ogni biglietto pagato riceve al pagamento un numero
 * progressivo annuale e una "fotografia" dei dati fiscali (campo `fiscal` del
 * booking), che non cambia piu' anche se cambiano le impostazioni.
 */

export interface FiscalSettings {
  /** Ragione sociale dell'emittente. */
  legalName: string;
  /** Partita IVA. */
  vatNumber: string;
  /** Codice fiscale (se diverso dalla partita IVA). */
  taxCode: string;
  /** Sede legale. */
  address: string;
  /** Aliquota IVA in percentuale, applicata al prezzo IVA inclusa. */
  vatRate: number;
  /** Nota sul biglietto (es. natura/riferimento normativo se l'aliquota e' 0). */
  vatNote: string;
}

export interface FiscalDoc {
  number: number;
  year: number;
  /** "2026/000123" */
  code: string;
  issuedAt: number;
  /** Giorno di emissione "YYYY-MM-DD" (giorno del corrispettivo). */
  date: string;
  legalName: string;
  vatNumber: string;
  taxCode: string;
  address: string;
  total: number;
  taxable: number;
  vat: number;
  vatRate: number;
  vatNote: string;
  paymentMethod: string;
}

export const MAX_VAT_RATE = 100;
export const REQUIRED_FISCAL_FIELDS: (keyof FiscalSettings)[] = ["legalName", "vatNumber", "address"];

const clean = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Default dal .env: COMPANY_LEGAL_NAME, COMPANY_VAT_NUMBER, COMPANY_TAX_CODE, COMPANY_ADDRESS, TICKET_VAT_RATE. */
export function defaultFiscalSettings(): FiscalSettings {
  const rate = Number(process.env.TICKET_VAT_RATE);
  return {
    legalName: clean(process.env.COMPANY_LEGAL_NAME) || clean(process.env.COMPANY_NAME),
    vatNumber: clean(process.env.COMPANY_VAT_NUMBER),
    taxCode: clean(process.env.COMPANY_TAX_CODE),
    address: clean(process.env.COMPANY_ADDRESS),
    vatRate: Number.isFinite(rate) && rate >= 0 && rate <= MAX_VAT_RATE ? rate : 10,
    vatNote: "",
  };
}

/** Sempre completo: campi assenti o non validi -> default. */
export function normalizeFiscalSettings(raw: any): FiscalSettings {
  const d = defaultFiscalSettings();
  const s = raw || {};
  const rate = Number(s.vatRate);
  return {
    legalName: clean(s.legalName) || d.legalName,
    vatNumber: s.vatNumber !== undefined ? clean(s.vatNumber, 40) : d.vatNumber,
    taxCode: s.taxCode !== undefined ? clean(s.taxCode, 40) : d.taxCode,
    address: s.address !== undefined ? clean(s.address) : d.address,
    vatRate: s.vatRate !== undefined && s.vatRate !== null && s.vatRate !== "" && Number.isFinite(rate) && rate >= 0 && rate <= MAX_VAT_RATE ? rate : d.vatRate,
    vatNote: s.vatNote !== undefined ? clean(s.vatNote) : d.vatNote,
  };
}

/** Campi obbligatori mancanti: con dati mancanti il biglietto non vale come documento fiscale. */
export function missingFiscalFields(s: FiscalSettings): (keyof FiscalSettings)[] {
  return REQUIRED_FISCAL_FIELDS.filter((k) => !String(s[k] ?? "").trim());
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Scorporo dell'IVA da un importo IVA inclusa, in centesimi (imponibile + IVA = totale). */
export function splitVat(total: number, rate: number): { total: number; taxable: number; vat: number } {
  const totalC = Math.round((Number(total) || 0) * 100);
  const taxableC = Math.round((totalC * 100) / (100 + (Number(rate) || 0)));
  return { total: totalC / 100, taxable: taxableC / 100, vat: (totalC - taxableC) / 100 };
}

export function fiscalCode(year: number, number: number): string {
  return `${year}/${String(number).padStart(6, "0")}`;
}

/** Metodo di pagamento del booking ("stripe", "cash", ...). */
export function paymentMethodOf(book: any): string {
  if (typeof book?.paymentMethod === "string" && book.paymentMethod) return book.paymentMethod;
  return book?.paymentIntentId ? "stripe" : "other";
}

/** Fotografia fiscale del biglietto al momento del pagamento. */
export function buildFiscalDoc(book: any, settings: FiscalSettings, number: number, issuedAt: Date): FiscalDoc {
  const year = issuedAt.getFullYear();
  const split = splitVat(book.total, settings.vatRate);
  return {
    number,
    year,
    code: fiscalCode(year, number),
    issuedAt: issuedAt.getTime(),
    date: localDate(issuedAt),
    legalName: settings.legalName,
    vatNumber: settings.vatNumber,
    taxCode: settings.taxCode,
    address: settings.address,
    total: split.total,
    taxable: split.taxable,
    vat: split.vat,
    vatRate: settings.vatRate,
    vatNote: settings.vatNote,
    paymentMethod: paymentMethodOf(book),
  };
}

// ---------------------------------------------------------------- report

export interface FiscalAmounts {
  count: number;
  gross: number;
  taxable: number;
  vat: number;
  refundsCount: number;
  refunds: number;
  refundsTaxable: number;
  refundsVat: number;
  /** Corrispettivi al netto dei rimborsi. */
  net: number;
  netTaxable: number;
  netVat: number;
}

export interface FiscalDay extends FiscalAmounts {
  date: string;
  firstCode: string;
  lastCode: string;
  byMethod: Record<string, number>;
}

export interface FiscalTicketRow {
  code: string;
  date: string;
  issuedAt: number;
  ticket: string;
  customer: string;
  route: string;
  travelDate: string;
  from: string;
  to: string;
  paymentMethod: string;
  vatRate: number;
  gross: number;
  taxable: number;
  vat: number;
  refunded: number;
  status: string;
}

export interface FiscalRefundRow {
  date: string;
  at: number;
  code: string;
  ticket: string;
  customer: string;
  paymentMethod: string;
  vatRate: number;
  amount: number;
  taxable: number;
  vat: number;
  full: boolean;
  description: string;
}

export interface FiscalReport {
  from: string;
  to: string;
  totals: FiscalAmounts;
  byMethod: Record<string, FiscalAmounts>;
  byVatRate: Record<string, FiscalAmounts>;
  days: FiscalDay[];
  tickets: FiscalTicketRow[];
  refunds: FiscalRefundRow[];
}

function emptyAmounts(): FiscalAmounts {
  return { count: 0, gross: 0, taxable: 0, vat: 0, refundsCount: 0, refunds: 0, refundsTaxable: 0, refundsVat: 0, net: 0, netTaxable: 0, netVat: 0 };
}

function addSale(a: FiscalAmounts, f: { total: number; taxable: number; vat: number }) {
  a.count += 1;
  a.gross = round2(a.gross + f.total);
  a.taxable = round2(a.taxable + f.taxable);
  a.vat = round2(a.vat + f.vat);
  finish(a);
}

function addRefund(a: FiscalAmounts, r: { amount: number; taxable: number; vat: number }) {
  a.refundsCount += 1;
  a.refunds = round2(a.refunds + r.amount);
  a.refundsTaxable = round2(a.refundsTaxable + r.taxable);
  a.refundsVat = round2(a.refundsVat + r.vat);
  finish(a);
}

function finish(a: FiscalAmounts) {
  a.net = round2(a.gross - a.refunds);
  a.netTaxable = round2(a.taxable - a.refundsTaxable);
  a.netVat = round2(a.vat - a.refundsVat);
}

/**
 * Rimborsi di un biglietto: lo storico `refunds` (rimborsi dal pannello) e, se il
 * biglietto risulta rimborsato per un importo maggiore dello storico (rimborso
 * dalla dashboard Stripe o dal cliente), la differenza alla data del rimborso.
 */
export function refundsOf(book: any): { at: number; amount: number; full: boolean; description: string }[] {
  const f: FiscalDoc = book.fiscal;
  const list = (Array.isArray(book.refunds) ? book.refunds : [])
    .filter((r: any) => Number(r?.amount) > 0)
    .map((r: any) => ({ at: Number(r.at) || 0, amount: round2(Number(r.amount)), full: !!r.full, description: String(r.description || "") }));
  const recorded = round2(list.reduce((s: number, r: any) => s + r.amount, 0));
  if (book.status === "refunded" && round2(f.total - recorded) > 0) {
    list.push({ at: Number(book.refundedAt || book.updatedAt) || f.issuedAt, amount: round2(f.total - recorded), full: recorded === 0, description: "" });
  }
  return list;
}

const methodBucket = (m: string) => (m === "stripe" || m === "cash" ? m : "other");

/**
 * Report dei corrispettivi del periodo [from, to] (date "YYYY-MM-DD" incluse):
 * vendite per giorno di emissione, rimborsi per giorno del rimborso.
 * `books`: booking con `fiscal` (possono includere biglietti fuori periodo).
 */
export function buildFiscalReport(books: any[], from: string, to: string, dateOf: (ms: number) => string = (ms) => localDate(new Date(ms))): FiscalReport {
  const totals = emptyAmounts();
  const byMethod: Record<string, FiscalAmounts> = {};
  const byVatRate: Record<string, FiscalAmounts> = {};
  const days = new Map<string, FiscalDay>();
  const tickets: FiscalTicketRow[] = [];
  const refunds: FiscalRefundRow[] = [];
  const inRange = (d: string) => d >= from && d <= to;
  const day = (d: string) => {
    let x = days.get(d);
    if (!x) {
      x = { date: d, firstCode: "", lastCode: "", byMethod: {}, ...emptyAmounts() };
      days.set(d, x);
    }
    return x;
  };
  const bucket = (map: Record<string, FiscalAmounts>, k: string) => (map[k] ||= emptyAmounts());

  const sorted = books.filter((b) => b?.fiscal?.code).sort((a, b) => a.fiscal.year - b.fiscal.year || a.fiscal.number - b.fiscal.number);
  for (const b of sorted) {
    const f: FiscalDoc = b.fiscal;
    const method = methodBucket(f.paymentMethod);
    const rate = String(f.vatRate);
    const customer = String(b.user?.name || "");
    const bookRefunds = refundsOf(b);

    if (inRange(f.date)) {
      const d = day(f.date);
      addSale(d, f);
      d.byMethod[method] = round2((d.byMethod[method] || 0) + f.total);
      if (!d.firstCode) d.firstCode = f.code;
      d.lastCode = f.code;
      addSale(totals, f);
      addSale(bucket(byMethod, method), f);
      addSale(bucket(byVatRate, rate), f);
      tickets.push({
        code: f.code,
        date: f.date,
        issuedAt: f.issuedAt,
        ticket: b.numberOfTickets,
        customer,
        route: String(b.name?.it || Object.values(b.name || {})[0] || ""),
        travelDate: String(b.date || ""),
        from: String(b.from?.name || ""),
        to: String(b.to?.name || ""),
        paymentMethod: f.paymentMethod,
        vatRate: f.vatRate,
        gross: f.total,
        taxable: f.taxable,
        vat: f.vat,
        refunded: round2(bookRefunds.reduce((s, r) => s + r.amount, 0)),
        status: String(b.status || ""),
      });
    }

    for (const r of bookRefunds) {
      const rd = dateOf(r.at);
      if (!inRange(rd)) continue;
      const split = splitVat(r.amount, f.vatRate);
      const row = { amount: split.total, taxable: split.taxable, vat: split.vat };
      addRefund(day(rd), row);
      addRefund(totals, row);
      addRefund(bucket(byMethod, method), row);
      addRefund(bucket(byVatRate, rate), row);
      refunds.push({ date: rd, at: r.at, code: f.code, ticket: b.numberOfTickets, customer, paymentMethod: f.paymentMethod, vatRate: f.vatRate, ...row, full: r.full, description: r.description });
    }
  }

  refunds.sort((a, b) => a.at - b.at);
  return { from, to, totals, byMethod, byVatRate, days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)), tickets, refunds };
}
