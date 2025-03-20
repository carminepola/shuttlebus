import { Db } from "mongodb";
import MailService from "./mailServices";
import { Mail } from "../../model/mailModel";
import booking from "../../model/bookFromSiteModel";
class MailSenderServices {
  private mailService: MailService;

  constructor(db: Db) {
    this.mailService = new MailService(db);
  }

  transformBookGeneric(book: booking) {
    let passeggeri = "";
    for (let i = 0; i < book.ticketTypes.length; i++) {
      passeggeri += `${book.ticketTypes[i].count}x ${book.ticketTypes[i].name.it}   <br>`;
    }
    let numBiglietto = book.numberOfTickets;
    let data1 = book.date.split("-");
    let data = `${data1[2]}/${data1[1]}/${data1[0]}`;
    let linea = book.name.it;
    let da = `${book.from.name} (${book.from.stopTime})`;
    let a = `${book.to.name} (${book.to.stopTime})`;
    let MESSAGE = `
    <h3>${numBiglietto}</h3>
    <p><strong>Data:</strong>${data}</p>
    <p><strong>Linea:</strong>${linea}</p>
    <p><strong>Da:</strong>${da}</p>
    <p><strong>A:</strong>${a}</p>
    <p><strong>Posti:</strong>${book.seats.toString()}</p>
    <p>${passeggeri}</p>
    <p><strong>Bagagli extra:</strong>${book.luggage.toString()}</p>
    <p><strong>Totale:</strong>${book.total.toString()} €</p>
    `;

    return MESSAGE;
  }

  transformBook(book: booking, lng: string = "it") {
    let passeggeri = "";
    for (let i = 0; i < book.ticketTypes.length; i++) {
      let name = lng === "it" ? book.ticketTypes[i].name.it : book.ticketTypes[i].name.en;
      passeggeri += `${book.ticketTypes[i].count}x ${name}<br>`;
    }
    let numBiglietto = book.numberOfTickets;
    let data1 = book.date.split("-");
    let data = `${data1[2]}/${data1[1]}/${data1[0]}`;
    let linea = lng === "it" ? book.name.it : book.name.en;
    let da = `${book.from.name} (${book.from.stopTime})`;
    let a = `${book.to.name} (${book.to.stopTime})`;
    let MESSAGE = `

    <div><strong>${lng === "it" ? "Data" : "Date"}:</strong> ${data}  </div>
     <div><strong>${lng === "it" ? "Linea" : "Route"}:</strong> ${linea}  </div>
      <div><strong>${lng === "it" ? "Da" : "From"}:</strong> ${da}  </div>
      <div><strong>${lng === "it" ? "A" : "To"}:</strong> ${a}  </div>
      <div> <strong>${lng === "it" ? "Passeggeri" : "Passengers"}:</strong> <br> ${passeggeri} </div>
      
    
    `;
    if (book.luggage > 0) {
      MESSAGE += `
      <div><strong>${lng === "it" ? "Bagagli extra" : "Extra luggage"}:</strong> ${book.luggage}  </div>  
      `;
    }
    return MESSAGE;
  }

  async sendRefoundBook(to: string, name: string, amount: string, order_id: string, lng: string = "it") {
    let type = "REFUND_PROCESSED";
    if (lng !== "it") {
      type = "REFUND_PROCESSED_EN";
    }
    this.mailService.sendMail(
      new Mail({
        to: to,
        type: type,
        bodyVariables: {
          name,
          order_id,
          amount,
        },
      })
    );
  }

  async sendConfirmBook(email: string, name: string, order_id: string, amount: string, payment_method: string, route: string, lng: string = "it") {
    let type = "PURCHASE_COMPLETED";
    if (lng !== "it") {
      type = "PURCHASE_COMPLETED_EN";
    }
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
          url: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" + process.env.CLIENT_URL + "/ticket/check/" + order_id,
        },
      })
    );
  }

  async sendCancelBook(email: string, name: string, order_id: string, lng: string = "it") {
    let type = "PURCHASE_CANCELLED";
    if (lng !== "it") {
      type = "PURCHASE_CANCELLED_EN";
    }
    this.mailService.sendMail(
      new Mail({
        to: email,
        type: type,
        bodyVariables: {
          name,
          order_id,
        },
      })
    );
  }

  async sendRecoverPassword(email: string, name: string, newPassword: string, lng: string = "it") {
    let type = "RECOVER_PASSWORD";
    if (lng !== "it") {
      type = "RECOVER_PASSWORD_EN";
    }

    this.mailService.sendMail(
      new Mail({
        to: email,
        type: type,
        bodyVariables: {
          name: name,
          mail: email,
          password: newPassword,
        },
      })
    );
  }
  async sendWelcomeMail(to: string, name: string, pin: string, email: string, lng: string = "it") {
    let type = "WELCOME";
    if (lng !== "it") {
      type = "WELCOME_EN";
    }

    this.mailService.sendMail(
      new Mail({
        to: to,
        type: type,
        bodyVariables: {
          name: name,
          pin: pin,
        },
      })
    );
  }

  async sendGenericMail(to: string, title: string, body: string) {
    this.mailService.sendMail(
      new Mail({
        to: to,
        type: "GENERIC",
        bodyVariables: {
          title: title,
          body: body,
        },
      })
    );
  }
}

export default MailSenderServices;
