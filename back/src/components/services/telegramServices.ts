import * as dotenv from "dotenv";
import booking from "../../model/bookFromSiteModel";
import { logger } from "../..";

dotenv.config();
const token = process.env.TELEGRAM_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
// stringa del .env: attivo solo con "true" (prima anche "false" lo attivava)
const botEnabled = ["true", "1"].includes((process.env.TELEGRAM_ENABLED || "").toLowerCase());
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
    // MarkdownV2: ogni valore viene escapato una sola volta
    const md = (v: any) => String(v ?? "").replace(/([\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, "\\$1");
    // nomi multilingua: lingua del biglietto, poi italiano, poi il primo disponibile
    const pick = (o: any) => (o && typeof o === "object" ? o[book.lng] || o.it || Object.values(o).find((x) => typeof x === "string" && x) || "" : String(o ?? ""));
    const passeggeri = (book.ticketTypes || []).map((t: any) => `🎟 ${md(`${t.count}x ${pick(t.name)}`)}`).join("\n");
    const [y, m, d] = String(book.date || "").split("-");
    let MESSAGE = ` 
${titolo}
🎟 *Numero Biglietto*: ${md(book.numberOfTickets)}
📅 *Data:* ${md(`${d}/${m}/${y}`)}
🚂 *Linea:* ${md(pick(book.name))}
🚍 *Da:* ${md(`${book.from.name} (${book.from.stopTime})`)}
📍 *A:* ${md(`${book.to.name} (${book.to.stopTime})`)}
👥 *Passeggeri:* ${md(book.seats)}
${passeggeri}
🛄 *Bagagli Extra:* ${md(book.luggage)}
💰 *Totale:* ${md(book.total)} ${md(process.env.CURRENCY || "EUR")}`;
    if (book.cancelMotivation) {
      MESSAGE += "\n" + md("Motivo annullamento: " + book.cancelMotivation);
    }
    return MESSAGE;
  }
}
