/**
 * Emissione biglietti da admin: cliente registrato / ospite (nome + mail),
 * pagamento contanti o omaggio, collegamento dei biglietti ospite all'account.
 * Nessuna dipendenza da Mongo: servizi interni sostituiti con mock.
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
import { role } from "../src/enum/role";

const ADMIN = { _id: "64100000000000000000aaaa", email: "admin@test.it" };
const USER_ID = "641000000000000000000001";

function makeService(opts: { userById?: any; userByEmail?: any } = {}) {
  const s: any = new BookingsServices({ collection: () => ({}) } as any);
  s.userServices = {
    getUserById: jest.fn(async () => opts.userById ?? null),
    getUserByEmailAll: jest.fn(async () => opts.userByEmail ?? null),
  };
  s.checkPriceAndTime = jest.fn(async () => true);
  s.createBookingInTransaction = jest.fn(async (legs: any[]) => legs.map((l, i) => ({ ...l, numberOfTickets: `SB${i}` })));
  s.bookingDao = {
    updatePaymentInfo: jest.fn(async () => ({})),
    markConfirmationSent: jest.fn(async () => true),
    claimGuestBookings: jest.fn(async () => 2),
  };
  s.sendConfirmation = jest.fn(async () => undefined);
  return s;
}

function ticket() {
  return { date: "2030-01-01", routeId: "r", scheduleId: "s", total: 100, seats: 1, luggage: 0, ticketTypes: [{ id: "adulto", count: 1, cost: 100 }], from: { id: "NA" }, to: { id: "MI" } };
}

describe("adminCreateBooking", () => {
  it("ospite: biglietto su guest:<mail>, contanti, mail inviata", async () => {
    const s = makeService();
    const res = await s.adminCreateBooking({ ticket: ticket(), customer: { name: "Mario", email: " Mario@Test.IT " }, paymentMode: "cash" }, ADMIN);

    expect(res).toEqual({ bookings: ["SB0"], userId: "guest:mario@test.it", guest: true });
    expect(s.checkPriceAndTime).toHaveBeenCalledWith(expect.anything(), { skipCutoff: true });
    const [, userId, mode, preset] = s.createBookingInTransaction.mock.calls[0];
    expect(userId).toBe("guest:mario@test.it");
    expect(mode).toBe("cash");
    expect(preset).toEqual({ id: "guest:mario@test.it", name: "Mario", mail: "mario@test.it", phone: undefined });
    expect(s.bookingDao.updatePaymentInfo).toHaveBeenCalledWith("cash", { type: "cash", issuedBy: { id: ADMIN._id, email: ADMIN.email } }, "SB0");
    expect(s.sendConfirmation).toHaveBeenCalledWith("SB0", "cash");
  });

  it("mail di un account attivo: il biglietto va sull'account", async () => {
    const s = makeService({ userByEmail: { _id: USER_ID, email: "mario@test.it", role: role.USER, details: { name: "Mario R." } } });
    const res = await s.adminCreateBooking({ ticket: ticket(), customer: { name: "Mario", email: "mario@test.it" }, paymentMode: "cash" }, ADMIN);
    expect(res.userId).toBe(USER_ID);
    expect(res.guest).toBe(false);
  });

  it("cliente registrato scelto per id", async () => {
    const s = makeService({ userById: { _id: USER_ID, email: "u@test.it", role: role.USER, details: { name: "U" } } });
    const res = await s.adminCreateBooking({ ticket: ticket(), customer: { userId: USER_ID }, paymentMode: "cash", sendMail: false }, ADMIN);
    expect(res.userId).toBe(USER_ID);
    expect(s.sendConfirmation).not.toHaveBeenCalled();
  });

  it("omaggio: costi e totale azzerati dopo il controllo prezzi", async () => {
    const s = makeService();
    await s.adminCreateBooking({ ticket: ticket(), customer: { name: "M", email: "m@test.it" }, paymentMode: "free" }, ADMIN);
    const [legs, , mode] = s.createBookingInTransaction.mock.calls[0];
    expect(mode).toBe("free");
    expect(legs[0].total).toBe(0);
    expect(legs[0].ticketTypes[0].cost).toBe(0);
  });

  it("rifiuta dati non validi", async () => {
    const s = makeService();
    await expect(s.adminCreateBooking({ ticket: ticket(), customer: { name: "M", email: "no-mail" }, paymentMode: "cash" }, ADMIN)).rejects.toMatchObject({ code: 400 });
    await expect(s.adminCreateBooking({ ticket: ticket(), customer: { name: "", email: "m@test.it" }, paymentMode: "cash" }, ADMIN)).rejects.toBeTruthy();
    await expect(s.adminCreateBooking({ ticket: ticket(), customer: { name: "M", email: "m@test.it" }, paymentMode: "stripe" }, ADMIN)).rejects.toBeTruthy();
    await expect(s.adminCreateBooking({ ticket: ticket(), customer: { userId: "guest:x" }, paymentMode: "cash" }, ADMIN)).rejects.toBeTruthy();
    expect(s.createBookingInTransaction).not.toHaveBeenCalled();
  });

  it("utente non validato (NO_PERMISSION) scelto per id -> 404", async () => {
    const s = makeService({ userById: { _id: USER_ID, email: "u@test.it", role: role.NO_PERMISSION } });
    await expect(s.adminCreateBooking({ ticket: ticket(), customer: { userId: USER_ID }, paymentMode: "cash" }, ADMIN)).rejects.toMatchObject({ code: 404 });
  });
});

describe("claimGuestBookings", () => {
  it("collega i biglietti guest:<mail> all'account attivo", async () => {
    const s = makeService({ userById: { _id: USER_ID, email: "Mario@Test.it", role: role.USER } });
    expect(await s.claimGuestBookings(USER_ID)).toBe(2);
    expect(s.bookingDao.claimGuestBookings).toHaveBeenCalledWith("guest:mario@test.it", USER_ID);
  });

  it("non collega per account non validati o id non validi", async () => {
    const s = makeService({ userById: { _id: USER_ID, email: "m@test.it", role: role.NO_PERMISSION } });
    expect(await s.claimGuestBookings(USER_ID)).toBe(0);
    expect(await s.claimGuestBookings("guest:m@test.it")).toBe(0);
    expect(s.bookingDao.claimGuestBookings).not.toHaveBeenCalled();
  });
});
