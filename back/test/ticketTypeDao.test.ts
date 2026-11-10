// il DAO importa il logger da src/index: si sostituisce per non avviare l'app
jest.mock("../src/index", () => ({ logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() } }));

import TicketTypeDao from "../src/components/dao/ticketTypeDao";

describe("tipi di biglietto attivi", () => {
  it("restituiscono giorni di validita' e flag della home (usati da ricerca e acquisto)", async () => {
    let projection: any;
    const db: any = {
      collection: () => ({
        find: () => ({
          project: (p: any) => {
            projection = p;
            return { toArray: async () => [] };
          },
        }),
      }),
    };
    await new TicketTypeDao(db).getAllActiveTicketType();
    expect(projection).toMatchObject({ daysOfWeek: 1, showOnHome: 1, cost: 1 });
  });
});
