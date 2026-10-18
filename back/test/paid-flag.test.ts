/**
 * Test unitari V8: flag `paid` calcolato server-side e gate download biglietto.
 * Nessuna dipendenza da Mongo/server: db stub + mock dei moduli con side effect.
 */
jest.mock("../src/index", () => ({
  client: {},
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  env: {},
  db: undefined,
  restServer: { isServerRunning: () => false },
  mailConfig: undefined,
}));
jest.mock("../src/stripe", () => ({ __esModule: true, default: { getInstance: () => ({}) } }));

import BookingsServices, { computePaid } from "../src/components/services/bookingServices";

const USER_ID = "641000000000000000000001";

function makeDb(list: any[], byTickets: Record<string, any> = {}) {
  return {
    collection: (name: string) => ({
      find: () => ({
        project: () => ({
          sort: () => ({
            toArray: async () => list,
          }),
        }),
      }),
      findOne: async (q: any) => byTickets[q.numberOfTickets] ?? null,
    }),
  } as any;
}

function baseBooking(overrides: any = {}) {
  return {
    userId: USER_ID,
    numberOfTickets: "SBTEST00001",
    date: "2026-10-30",
    status: "confirmed",
    total: 10,
    seats: 1,
    luggage: 0,
    ...overrides,
  };
}

describe("computePaid (flag server-side)", () => {
  it("confirmed + cash => paid true", () => {
    expect(computePaid(baseBooking({ paymentMethod: "cash", payment_status: "paid" }))).toBe(true);
    // record legacy non migrato (senza payment_status)
    const legacyCash: any = baseBooking({ paymentMethod: "cash" });
    delete legacyCash.payment_status;
    expect(computePaid(legacyCash)).toBe(true);
  });

  it("confirmed + stripe senza paymentIntentId => paid false", () => {
    const b: any = baseBooking({ payment_status: "unpaid", paymentMethod: "stripe", paymentIntentId: "" });
    expect(computePaid(b)).toBe(false);
  });

  it("pending => paid false (qualsiasi metodo)", () => {
    expect(computePaid(baseBooking({ status: "pending", payment_status: "unpaid" }))).toBe(false);
    expect(computePaid(baseBooking({ status: "pending", paymentMethod: "cash" }))).toBe(false);
  });

  it("confirmed + webhook: payment_status paid => paid true", () => {
    expect(computePaid(baseBooking({ payment_status: "paid", paymentIntentId: "pi_123", paymentMethod: "stripe" }))).toBe(true);
  });

  it("confirmed + stripe + paymentIntentId (legacy non migrato, scritto solo dal webhook) => paid true", () => {
    const b: any = baseBooking({ paymentMethod: "stripe", paymentIntentId: "pi_123" });
    delete b.payment_status;
    expect(computePaid(b)).toBe(true);
  });

  it("capture fallita: confirmed + paymentIntentId + payment_status failed => paid false", () => {
    expect(computePaid(baseBooking({ payment_status: "failed", paymentIntentId: "pi_123", paymentMethod: "stripe" }))).toBe(false);
  });

  it("refunded/cancelled/expired => paid false", () => {
    expect(computePaid(baseBooking({ status: "refunded", payment_status: "refunded" }))).toBe(false);
    expect(computePaid(baseBooking({ status: "cancelled", payment_status: "failed" }))).toBe(false);
  });
});

describe("getBookingFromUser: flag paid aggiunto a ogni booking", () => {
  it("mappa il flag in base allo stato di pagamento", async () => {
    const list = [
      baseBooking({ numberOfTickets: "SBCASH01", paymentMethod: "cash", payment_status: "paid" }),
      baseBooking({ numberOfTickets: "SBSTRIPE01", payment_status: "unpaid", paymentMethod: "stripe", paymentIntentId: "" }),
      baseBooking({ numberOfTickets: "SBPENDING01", status: "pending", payment_status: "unpaid" }),
    ];
    const services = new BookingsServices(makeDb(list));
    const result: any = await services.getBookingFromUser(USER_ID);

    expect(result).toHaveLength(3);
    expect(result.find((b: any) => b.numberOfTickets === "SBCASH01").paid).toBe(true);
    expect(result.find((b: any) => b.numberOfTickets === "SBSTRIPE01").paid).toBe(false);
    expect(result.find((b: any) => b.numberOfTickets === "SBPENDING01").paid).toBe(false);
  });
});

describe("getTicketForUser: gate download (200/404)", () => {
  const user = { _id: USER_ID, role: 100 };

  it("pagato + proprietario => restituisce booking con paid true", async () => {
    const paid = baseBooking({ payment_status: "paid", paymentIntentId: "pi_1", paymentMethod: "stripe" });
    const services = new BookingsServices(makeDb([], { SBTEST00001: paid }));
    const result = await services.getTicketForUser("SBTEST00001", user);
    expect(result).not.toBeNull();
    expect(result!.paid).toBe(true);
    expect(result!.booking.numberOfTickets).toBe("SBTEST00001");
    expect(result!.booking.userId).toBeUndefined();
    expect(result!.booking.paymentIntentId).toBeUndefined();
  });

  it("non pagato => null (route risponde 404)", async () => {
    const unpaid = baseBooking({ payment_status: "unpaid", paymentIntentId: "", paymentMethod: "stripe" });
    const services = new BookingsServices(makeDb([], { SBTEST00001: unpaid }));
    expect(await services.getTicketForUser("SBTEST00001", user)).toBeNull();
  });

  it("pagato ma di altro utente (non admin) => null", async () => {
    const other = baseBooking({ userId: "641000000000000000000002", payment_status: "paid" });
    const services = new BookingsServices(makeDb([], { SBTEST00001: other }));
    expect(await services.getTicketForUser("SBTEST00001", user)).toBeNull();
  });

  it("inesistente => null", async () => {
    const services = new BookingsServices(makeDb([], {}));
    expect(await services.getTicketForUser("SBNOTEXISTS", user)).toBeNull();
  });
});
