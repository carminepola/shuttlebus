import * as dotenv from "dotenv";
import booking from "../../model/bookFromSiteModel";
import { logger } from "../..";

dotenv.config();
const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const botEnabled = process.env.TELEGRAM_ENABLED || false;
export default class TelegramServices {
  constructor() {}

  async sendMessage(message: string) {
    if (botEnabled && token && chatId) {
      try {
        let res = fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "MarkdownV2",
          }),
        })
          .then((response: any) => response.text())
          .then((result: any) => logger.debug(result))
          .catch((error: any) => logger.error(error));
      } catch (error) {
        logger.error(error);
        return false;
      }

      return true;
    }
  }

  public bookToMessage(book: booking, titolo: string): string {
    let passeggeri = "";
    for (let i = 0; i < book.ticketTypes.length; i++) {
      passeggeri += `🎟 ${book.ticketTypes[i].count}x ${book.ticketTypes[i].name.it}   \n`.replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1");
    }
    let numBiglietto = book.numberOfTickets.replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1");
    let data = book.date.replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1");
    let linea = book.name.it.replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1");
    let da = `${book.from.name} (${book.from.stopTime})`.replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1");
    let a = `${book.to.name} (${book.to.stopTime})`.replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1");
    let MESSAGE = ` 
${titolo}
🎟 *Numero Biglietto*: ${numBiglietto}
📅 *Data:* ${data}
🚂 *Linea:* ${linea}
🚍 *Da:* ${da}
📍 *A:* ${a}
👥 *Passeggeri:* ${book.seats.toString().replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1")}
${passeggeri.replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1")} 
🛄 *Bagagli Extra:* ${book.luggage.toString().replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1")}
💰 *Totale:* ${book.total.toString().replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1")} €`;
    if (book.cancelMotivation) {
      MESSAGE += ("\n Motivo annullamento: " + book.cancelMotivation).replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1");
    }
    return MESSAGE;
  }
}
