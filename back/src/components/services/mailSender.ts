import { Db } from "mongodb";
import MailService from "./mailServices";
import { Mail } from "../../model/mailModel";
import booking from "../../model/bookFromSiteModel";
import { Translator } from "../../i18n/translate";
import { escapeHtml } from "../../utils/company";
import { MailType } from "../../mail/mailTypes";
import { formatAmount } from "../../mail/renderMail";
import { getLanguageSettings } from "../../i18n/languages";
import { logger } from "../../index";

/**
 * Invio delle mail applicative. Ogni mail e' un tipo standard (mail/mailTypes.ts)
 * nella lingua del destinatario: testi da Impostazioni -> Traduzioni, layout unico.
 */
class MailSenderServices {
  private mailService: MailService;

  constructor(private db: Db) {
    this.mailService = new MailService(db);
  }

  /** Invio senza far cadere il chiamante: l'errore finisce nel log, il risultato e' true/false. */
  private async send(to: string, type: MailType, lng: string | undefined, variables: Record<string, string>): Promise<boolean> {
    if (!to) return false; // destinatario assente (es. prenotazione anonimizzata)
    try {
      return await this.mailService.sendMail(new Mail({ to, type, lng, bodyVariables: variables }));
    } catch (error: any) {
      logger.error(`Mail ${type} a ${to} non inviata: ${error?.message || error}`);
      return false;
    }
  }

  private name(obj: any, t: Translator): string {
    if (!obj || typeof obj !== "object") return String(obj ?? "");
    return obj[t.lng] || Object.values(obj).find((v) => typeof v === "string" && v) || "";
  }

  /** Riepilogo del biglietto (HTML escapato) nella lingua indicata. */
  async bookSummaryHtml(book: booking, lng?: string, withHeader = false): Promise<string> {
    const t = await Translator.for(this.db, lng);
    const locale = (await getLanguageSettings(this.db)).languages.find((l) => l.code === t.lng)?.locale || t.lng;
    const [y, m, d] = String(book.date || "").split("-");
    const row = (label: string, value: string) =>
      `<tr><td style="padding:4px 12px 4px 0;color:#666666;vertical-align:top;white-space:nowrap;">${escapeHtml(t.t(label))}</td><td style="padding:4px 0;">${value}</td></tr>`;
    const passengers = (book.ticketTypes || [])
      .filter((x: any) => x.count > 0)
      .map((x: any) => `${x.count}× ${escapeHtml(this.name(x.name, t))}`)
      .join("<br>");
    const rows = [
      withHeader ? row("mail_label_ticket", `<strong>${escapeHtml(book.numberOfTickets)}</strong>`) : "",
      row("mail_label_date", escapeHtml(d ? `${d}/${m}/${y}` : String(book.date))),
      row("mail_label_route", escapeHtml(this.name(book.name, t))),
      row("mail_label_from", escapeHtml(`${book.from?.name ?? ""} (${book.from?.stopTime ?? ""})`)),
      row("mail_label_to", escapeHtml(`${book.to?.name ?? ""} (${book.to?.stopTime ?? ""})`)),
      row("mail_label_passengers", passengers),
      book.luggage > 0 ? row("mail_label_extra_luggage", String(book.luggage)) : "",
      withHeader ? row("mail_label_total", escapeHtml(formatAmount(String(book.total), locale))) : "",
    ].join("");
    return `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${rows}</table>`;
  }

  /** Riepilogo per le notifiche interne (MAIL_ADMIN), nella lingua predefinita. */
  async transformBookGeneric(book: booking): Promise<string> {
    return this.bookSummaryHtml(book, undefined, true);
  }

  async sendRefoundBook(to: string, name: string, amount: string, order_id: string, lng?: string) {
    return this.send(to, "REFUND_PROCESSED", lng, { name, order_id, amount });
  }

  async sendConfirmBook(email: string, name: string, order_id: string, amount: string, payment_method: string, route: string, lng?: string) {
    return this.send(email, "PURCHASE_COMPLETED", lng, {
      name,
      order_id,
      amount,
      payment_method,
      route,
      mytickets_url: (process.env.CLIENT_URL || "") + "/user/mytickets",
    });
  }

  async sendCancelBook(email: string, name: string, order_id: string, lng?: string) {
    return this.send(email, "PURCHASE_CANCELLED", lng, { name, order_id });
  }

  async sendRecoverPassword(email: string, name: string, resetUrl: string, lng?: string) {
    // solo il link temporizzato di reset, mai una password
    return this.send(email, "RECOVER_PASSWORD", lng, { name, mail: email, url: resetUrl });
  }

  async sendWelcomeMail(to: string, name: string, pin: string, _email: string, lng?: string) {
    return this.send(to, "WELCOME", lng, { name, pin });
  }

  /** Codice di verifica (2FA, eliminazione account): true se la mail e' partita. */
  async sendMfaCode(to: string, code: string, lng?: string): Promise<boolean> {
    return this.send(to, "MFA_CODE", lng, { code });
  }

  async sendAccountDeleted(to: string, lng?: string) {
    return this.send(to, "ACCOUNT_DELETED", lng, {});
  }

  /** Notifica libera (es. MAIL_ADMIN): titolo e corpo HTML gia' pronti. */
  async sendGenericMail(to: string | undefined, title: string, body: string) {
    if (!to) return false;
    return this.send(to, "GENERIC", undefined, { title, body });
  }
}

export default MailSenderServices;
