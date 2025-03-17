import { Db } from "mongodb";
import { Mail } from "../../model/mailModel";
import { MailDao } from "../dao/mailDao";
import { logger, mailConfig, env } from "../../index";
import nodemailer from "nodemailer";
import { TemplateMailDao } from "../dao/templateMailDao";

class MailService {
  private mailDao: MailDao;
  private templateMailDao: TemplateMailDao;

  constructor(db: Db) {
    this.mailDao = new MailDao(db);
    this.templateMailDao = new TemplateMailDao(db);
  }

  /**
   * Parserizza un oggetto Mail per sostituire le variabili all'interno
   * di un template di email, se presente.
   * @param mail Oggetto Mail da parserizzare
   * @returns Oggetto Mail con le variabili sostituite
   */
  private async templateParser(mail: Mail): Promise<any> {
    let newMail = {
      id: mail.id,
      from: mailConfig.auth.user,
      to: mail.to,
      headers: {
        "Content-Type": "text/html; charset=UTF-8",
        "Content-Transfer-Encoding": "base64",
      },
      encoding: "base64",
      subject: "",
      html: "",
    };

    if (mail.type && mail.type != "default") {
      const templateMail = await this.templateMailDao.readTemplateMailType(mail.type);
      if (!templateMail) {
        mail.type = "default";
      } else {
        for (const [key, value] of Object.entries(mail.bodyVariables || {})) {
          templateMail.title = templateMail.title.replaceAll(`{${key}}`, value);
        }
        for (const [key, value] of Object.entries(mail.bodyVariables || {})) {
          templateMail.body = templateMail.body.replaceAll(`{${key}}`, value);
        }
        newMail.subject = templateMail.title;
        newMail.html = templateMail.body;
      }
    } else {
      newMail.subject = mail.title || "Nessun titolo";
      newMail.html = mail.message || "Nessun messaggio";
    }

    return newMail;
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
      }
    } catch (error: any) {
      throw error; // Propagazione opzionale
    }
    return false;
  }
}

export default MailService;
