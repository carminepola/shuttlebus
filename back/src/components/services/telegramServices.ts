import * as dotenv from "dotenv";
import booking from "../../model/bookFromSiteModel";
dotenv.config();
const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const botEnabled = process.env.TELEGRAM_ENABLED || false;
export default class TelegramServices {
  constructor() {}

  async sendMessage(message: string) {
    if (botEnabled && token && chatId) {
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "MarkdownV2",
        }),
      });
    } else {
      return true;
    }
  }

  public bookToMessage(book: booking, titolo: string): string {
    let passeggeri = "";
    for (let i = 0; i < book.ticketTypes.length; i++) {
      passeggeri += `${book.ticketTypes[i].name.it} X ${book.ticketTypes[i].count} \n`;
    }

    if (book.cancelMotivation) {
    }
    let MESSAGE = ` 
🎟 *Numero Biglietto: ${book.numberOfTickets}
📅 *Data:* ${book.date}
🚂 *Linea:* ${book.name.it}
🚍 *Da:* ${book.from.name} (${book.from.stopTime})
📍 *A:* ${book.to.name} (${book.to.stopTime})
👥 *Passeggeri:* 
${passeggeri} 
🛄 *Bagagli opzionali:* x${book.luggage}
💰 *Totale:* ${book.total} €`;
    if (book.cancelMotivation) {
      MESSAGE += "\n Motivo annullamento: " + book.cancelMotivation;
    }
    return MESSAGE;
  }
}
