import { Db } from 'mongodb';
import MailService from './mailServices';
import { Mail } from '../../model/mailModel';
import booking from '../../model/bookFromSiteModel';

type SupportedLng = 'it' | 'en' | 'fr' | 'de' | 'es' | 'jp';

const BOOK_LABELS: Record<SupportedLng, Record<string, string>> = {
  it: {
    date: 'Data',
    route: 'Linea',
    from: 'Da',
    to: 'A',
    passengers: 'Passeggeri',
    seats: 'Posti',
    extraLuggage: 'Bagagli extra',
    total: 'Totale',
  },
  en: {
    date: 'Date',
    route: 'Route',
    from: 'From',
    to: 'To',
    passengers: 'Passengers',
    seats: 'Seats',
    extraLuggage: 'Extra luggage',
    total: 'Total',
  },
  fr: {
    date: 'Date',
    route: 'Ligne',
    from: 'De',
    to: 'À',
    passengers: 'Passagers',
    seats: 'Places',
    extraLuggage: 'Bagages supplémentaires',
    total: 'Total',
  },
  de: {
    date: 'Datum',
    route: 'Linie',
    from: 'Von',
    to: 'Nach',
    passengers: 'Fahrgäste',
    seats: 'Sitzplätze',
    extraLuggage: 'Zusätzliches Gepäck',
    total: 'Gesamt',
  },
  es: {
    date: 'Fecha',
    route: 'Línea',
    from: 'Desde',
    to: 'Hasta',
    passengers: 'Pasajeros',
    seats: 'Asientos',
    extraLuggage: 'Equipaje adicional',
    total: 'Total',
  },
  jp: {
    date: '日付',
    route: '路線',
    from: '出発',
    to: '到着',
    passengers: '乗客',
    seats: '座席',
    extraLuggage: '追加荷物',
    total: '合計',
  },
};

function getLabel(key: string, lng: string): string {
  const supported = lng as SupportedLng;
  return BOOK_LABELS[supported]?.[key] ?? BOOK_LABELS.it[key];
}

function getBookName(book: booking, lng: string): string {
  const supported = lng as SupportedLng;
  return (book.name as any)[supported] ?? book.name.it;
}

function getTicketName(ticket: any, lng: string): string {
  const supported = lng as SupportedLng;
  return (ticket.name as any)[supported] ?? ticket.name.it;
}

class MailSenderServices {
  private mailService: MailService;

  constructor(db: Db) {
    this.mailService = new MailService(db);
  }

  transformBookGeneric(book: booking, lng: string = 'it') {
    let passeggeri = '';
    for (let i = 0; i < book.ticketTypes.length; i++) {
      passeggeri += `${book.ticketTypes[i].count}x ${getTicketName(book.ticketTypes[i], lng)}   <br>`;
    }
    let numBiglietto = book.numberOfTickets;
    let data1 = book.date.split('-');
    let data = `${data1[2]}/${data1[1]}/${data1[0]}`;
    let linea = getBookName(book, lng);
    let da = `${book.from.name} (${book.from.stopTime})`;
    let a = `${book.to.name} (${book.to.stopTime})`;
    let MESSAGE = `
    <h3>${numBiglietto}</h3>
    <p><strong>${getLabel('date', lng)}:</strong>${data}</p>
    <p><strong>${getLabel('route', lng)}:</strong>${linea}</p>
    <p><strong>${getLabel('from', lng)}:</strong>${da}</p>
    <p><strong>${getLabel('to', lng)}:</strong>${a}</p>
    <p><strong>${getLabel('seats', lng)}:</strong>${book.seats.toString()}</p>
    <p>${passeggeri}</p>
    <p><strong>${getLabel('extraLuggage', lng)}:</strong>${book.luggage.toString()}</p>
    <p><strong>${getLabel('total', lng)}:</strong>${book.total.toString()} €</p>
    `;

    return MESSAGE;
  }

  transformBook(book: booking, lng: string = 'it') {
    let passeggeri = '';
    for (let i = 0; i < book.ticketTypes.length; i++) {
      let name = getTicketName(book.ticketTypes[i], lng);
      passeggeri += `${book.ticketTypes[i].count}x ${name}<br>`;
    }
    let numBiglietto = book.numberOfTickets;
    let data1 = book.date.split('-');
    let data = `${data1[2]}/${data1[1]}/${data1[0]}`;
    let linea = getBookName(book, lng);
    let da = `${book.from.name} (${book.from.stopTime})`;
    let a = `${book.to.name} (${book.to.stopTime})`;
    let MESSAGE = `

    <div><strong>${getLabel('date', lng)}:</strong> ${data}  </div>
     <div><strong>${getLabel('route', lng)}:</strong> ${linea}  </div>
      <div><strong>${getLabel('from', lng)}:</strong> ${da}  </div>
      <div><strong>${getLabel('to', lng)}:</strong> ${a}  </div>
      <div> <strong>${getLabel('passengers', lng)}:</strong> <br> ${passeggeri} </div>
      
    
    `;
    if (book.luggage > 0) {
      MESSAGE += `
      <div><strong>${getLabel('extraLuggage', lng)}:</strong> ${book.luggage}  </div>  
      `;
    }
    return MESSAGE;
  }

  private getMailType(baseType: string, lng: string = 'it'): string {
    if (lng === 'it') return baseType;
    return baseType + '_' + lng.toUpperCase();
  }

  async sendRefoundBook(to: string, name: string, amount: string, order_id: string, lng: string = 'it') {
    let type = this.getMailType('REFUND_PROCESSED', lng);
    this.mailService.sendMail(
      new Mail({
        to: to,
        type: type,
        bodyVariables: {
          name,
          order_id,
          amount,
          img: process.env.CLIENT_URL + '/assets/pintour-logo.png',
        },
      }),
    );
  }

  async sendConfirmBook(email: string, name: string, order_id: string, amount: string, payment_method: string, route: string, lng: string = 'it') {
    let type = this.getMailType('PURCHASE_COMPLETED', lng);
    this.mailService.sendMail(
      new Mail({
        to: email,
        type: type,
        bodyVariables: {
          name,
          order_id,
          amount,
          payment_method,
          route,
          img: process.env.CLIENT_URL + '/assets/pintour-logo.png',
          url: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + order_id,
          mytickets_url: process.env.CLIENT_URL + '/user/mytickets',
        },
      }),
    );
  }

  async sendCancelBook(email: string, name: string, order_id: string, lng: string = 'it') {
    let type = this.getMailType('PURCHASE_CANCELLED', lng);
    this.mailService.sendMail(
      new Mail({
        to: email,
        type: type,
        bodyVariables: {
          name,
          order_id,
          img: process.env.CLIENT_URL + '/assets/pintour-logo.png',
        },
      }),
    );
  }

  async sendRecoverPassword(email: string, name: string, newPassword: string, lng: string = 'it') {
    let type = this.getMailType('RECOVER_PASSWORD', lng);

    this.mailService.sendMail(
      new Mail({
        to: email,
        type: type,
        bodyVariables: {
          name: name,
          mail: email,
          password: newPassword,
          img: process.env.CLIENT_URL + '/assets/pintour-logo.png',
        },
      }),
    );
  }

  async sendWelcomeMail(to: string, name: string, pin: string, email: string, lng: string = 'it') {
    let type = this.getMailType('WELCOME', lng);

    this.mailService.sendMail(
      new Mail({
        to: to,
        type: type,
        bodyVariables: {
          name: name,
          pin: pin,
          img: process.env.CLIENT_URL + '/assets/pintour-logo.png',
        },
      }),
    );
  }

  async sendGenericMail(to: string, title: string, body: string) {
    this.mailService.sendMail(
      new Mail({
        to: to,
        type: 'GENERIC',
        bodyVariables: {
          title: title,
          body: body,
          img: process.env.CLIENT_URL + '/assets/pintour-logo.png',
        },
      }),
    );
  }
}

export default MailSenderServices;
