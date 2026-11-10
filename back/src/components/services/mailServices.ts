import { Db } from "mongodb";
import { Mail } from "../../model/mailModel";
import { MailDao } from "../dao/mailDao";
import { logger, mailConfig, env } from "../../index";
import nodemailer from "nodemailer";
import { companyInfo } from "../../utils/company";
import { renderMail } from "../../mail/renderMail";
import { isMailType } from "../../mail/mailTypes";

class MailService {
  private mailDao: MailDao;

  constructor(private db: Db) {
    this.mailDao = new MailDao(db);
  }

  /**
   * Oggetto e corpo della mail: i tipi standard (mail/mailTypes.ts) passano dal layout
   * unico con i testi tradotti nella lingua della mail; il tipo "default" usa
   * titolo e HTML passati cosi' come sono (mail di prova).
   */
  private async templateParser(mail: Mail): Promise<any> {
    // mittente col nome dell'azienda (COMPANY_NAME); niente virgolette che romperebbero l'header
    const fromName = companyInfo().name.replace(/["<>\r\n]/g, "");
    let newMail: any = {
      id: mail.id,
      from: `"${fromName}" <${mailConfig.auth.user}>`,
      to: mail.to,
      replyTo: mailConfig.auth.user,
      subject: "",
      text: "",
      html: "",
    };

    if (isMailType(mail.type)) {
      const rendered = await renderMail(this.db, mail.type, mail.lng, mail.bodyVariables || {});
      newMail.subject = rendered.subject;
      newMail.html = rendered.html;
    } else {
      if (mail.type && mail.type !== "default") {
        logger.warn(`Tipo di mail sconosciuto "${mail.type}": inviata con titolo e testo liberi`);
      }
      // salvata in DB il testo sta in `html` (Mail lo copia da `message`)
      newMail.subject = mail.title || "";
      newMail.html = (mail as any).message || mail.html || "";
    }
    newMail.text = this.htmlToText(newMail.html);
    return newMail;
  }

  private htmlToText(html: string): string {
    if (!html) return "";
    return html
      .replace(/<head[\s\S]*?<\/head>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+/g, " ")
      .replace(/ ?\n ?/g, "\n")
      .trim();
  }

  private async send(newMail: Mail): Promise<{ mailSent: boolean; errorMessage: string }> {
    let transporter: nodemailer.Transporter | null = null;
    let mailSended = false;

    let id = newMail.id;
    let attempts = 0;
    let errorMessage = "";

    let log = {
      id,
      attempts,
    };

    try {
      do {
        transporter = nodemailer.createTransport(mailConfig as nodemailer.TransportOptions);
        const isValid = await transporter.verify();
        if (!isValid) {
          throw new Error("Failed to initialize email transport");
        }
        try {
          let res = await transporter.sendMail(newMail);
          if (res.accepted && res.accepted.length > 0) {
            mailSended = true;
            await this.mailDao.updateTry(id, true);
          } else {
            throw new Error("Failed to send");
          }
        } catch (error: any) {
          attempts++;
          mailSended = false;
          await this.mailDao.updateTry(id, false);
          logger.error(error.message, log);
          if (attempts < 3) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
          } else {
            throw new Error("Failed to send email after 3 attempts");
          }
        }
      } while (!mailSended && attempts < 3);
    } catch (error: any) {
      logger.error(error?.message, log);
      errorMessage = error?.message;
    } finally {
      if (transporter) {
        transporter.close();
      }
    }
    return { mailSent: mailSended, errorMessage };
  }
  public async sendMail(mailData: Mail): Promise<boolean> {
    try {
      if (!mailConfig) {
        throw new Error("Email: manca la configurazione");
      }
      if (!mailData.to) {
        throw new Error("Email, manca il destinatario");
      }
      const createdMail = await this.mailDao.createMail(mailData);
      if (createdMail._id) return await this.sendMailId(createdMail.id!);
    } catch (error) {
      throw error;
    }
    return false;
  }

  public async sendMailId(id: string): Promise<boolean> {
    try {
      if (!mailConfig) {
        throw new Error("Email: manca la configurazione");
      }

      if (!id) {
        throw new Error("Email: manca l'id");
      }

      const mail = await this.mailDao.readMailById(id);

      if (!mail) {
        throw new Error("Email: mail non trovata con l'id fornito");
      }

      const newMail = await this.templateParser(mail);
      if (!newMail) {
        throw new Error("Email: manca il template");
      }
      if (env.EMAIL_ASYNC?.toLocaleLowerCase() == "true") {
        this.send(newMail);
        return true;
      } else {
        let emailSended = await this.send(newMail);
        if (!emailSended.mailSent) {
          throw new Error(emailSended.errorMessage);
        }
        return true;
      }
    } catch (error: any) {
      logger.error(`Email non inviata: ${error?.message || error}`);
    }
    return false;
  }
}

export default MailService;
