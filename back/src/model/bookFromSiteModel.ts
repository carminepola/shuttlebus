import { generateTicketId } from "../utils/ticketId";

export default class booking {
  userId: string;
  numberOfTickets: string;
  date: string;
  routeId: string;
  scheduleId: string;
  total: number;
  luggage: number;
  seats: number;
  name: Name;
  from: From;
  to: To;
  ticketTypes: TicketType[];
  lng: string;
  status: "pending" | "confirmed" | "expired" | "cancelled" | "refunded" | "deleted";
  payment_status: "unpaid" | "paid" | "failed" | "refunded";
  createdAt: number;
  updatedAt: number;
  paymentMethod: { type: string; data: any }[];
  other: any;
  user: any;
  paymentIntentId?: string;
  cancelMotivation?: string;
  refundedAmount?: number;
  scannedBy?: { driverId: string; driverName: string; scannedAt: number };
  constructor(book: any) {
    try {
      if (book.userId === undefined) throw new Error("userId is required");
      if (book.date === undefined) throw new Error("date is required");
      if (book.routeId === undefined) throw new Error("routeId is required");
      if (book.scheduleId === undefined) throw new Error("scheduleId is required");
      if (book.total === undefined) throw new Error("total is required");
      if (book.luggage === undefined) throw new Error("luggage is required");
      if (book.seats === undefined) throw new Error("seats is required");
      if (book.name === undefined) throw new Error("name is required");
      if (book.from === undefined) throw new Error("from is required");
      if (book.to === undefined) throw new Error("to is required");
      if (book.ticketTypes === undefined) throw new Error("ticketTypes is required");
      if (book.lng === undefined) throw new Error("lng is required");

      this.userId = book.userId;
      this.numberOfTickets = book.numberOfTickets || generateTicketId(book.date, book.user?.mail);
      this.date = book.date;
      this.scheduleId = book.scheduleId;
      this.routeId = book.routeId;
      this.total = book.total;
      this.luggage = book.luggage;
      this.seats = book.seats;
      this.name = book.name;
      this.from = book.from;
      this.to = book.to;
      this.ticketTypes = book.ticketTypes;
      this.lng = book.lng;
      this.status = book.status ? book.status : "pending";
      this.payment_status = book.payment_status ? book.payment_status : "unpaid";
      this.createdAt = book.createdAt ? book.createdAt : new Date().getTime();
      this.updatedAt = new Date().getTime();
      this.paymentMethod = book.paymentMethod ? book.paymentMethod : [];
      this.user = book.user;
      this.paymentIntentId = book.paymentIntentId || "";
      this.cancelMotivation = book.cancelMotivation || "";
      this.refundedAmount = book.refundedAmount || 0;
      this.other = book.other;
    } catch (error) {
      throw error;
    }
  }
}

export class Name {
  it: string;
  en: string;
  fr?: string;
  de?: string;
  es?: string;
  jp?: string;
  constructor(name: any) {
    this.it = name.it;
    this.en = name.en;
    this.fr = name.fr;
    this.de = name.de;
    this.es = name.es;
    this.jp = name.jp;
  }
}

export class From {
  id: string;
  name: string;
  description: Description;
  address: string;
  stopTime: string;
  constructor(from: any) {
    this.id = from.id;
    this.name = from.name;
    this.description = from.description;
    this.address = from.address;
    this.stopTime = from.stopTime;
  }
}

export class Description {
  it: string;
  en: string;
  fr?: string;
  de?: string;
  es?: string;
  jp?: string;
  constructor(description: any) {
    this.it = description.it;
    this.en = description.en;
    this.fr = description.fr;
    this.de = description.de;
    this.es = description.es;
    this.jp = description.jp;
  }
}

export class To {
  id: string;
  name: string;
  description: Description;
  address: string;
  stopTime: string;
  constructor(to: any) {
    this.id = to.id;
    this.name = to.name;
    this.description = to.description;
    this.address = to.address;
    this.stopTime = to.stopTime;
  }
}

export class TicketType {
  id: string;
  name: Name;
  description: Description;
  cost: number;
  count: number;
  constructor(ticketType: any) {
    this.id = ticketType.id;
    this.name = ticketType.name;
    this.description = ticketType.description;
    this.cost = ticketType.cost;
    this.count = ticketType.count;
  }
}
