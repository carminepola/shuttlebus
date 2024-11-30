import { promises as fs } from 'fs';
import { join } from 'path';
import { Mail } from '../model/mailModel';
import { MailDao } from '../dao/mailDao/mailDao';
import { logger, db, mailConfig } from '../index';
import nodemailer from "nodemailer";
import { TemplateMailDao } from '../dao/templateMailDao/templateMailDao';
import { debug } from 'console';
import e from 'express';
class MailService {

  logInfo:any;
  nodemailer: any;
  constructor() {

    

  }

  async templateParser(mail: Mail) {
    try {
      this.nodemailer.sendMail();
      let newMail = {
        from: mailConfig.auth.user,
        to: mail.to,
        subject: "",
        html: "",
      };
      let templateMail: any;

      if (mail.type && mail.type != 'default') {
        let templateMailDao = new TemplateMailDao(db);
        templateMail = await templateMailDao.readTemplateMailType(mail.type);
        if (!templateMail) {
          mail.type = "default";
        }
      }

      if (mail.type == 'default') {
        newMail.subject = mail.title || "Nessun titolo";
        newMail.html = mail.message || "Nessun messaggio";
      } else {
        for (const [key, value] of Object.entries(mail.titleVariable || {})) {
          templateMail.title = templateMail.title.replaceAll(`{${key}}`, value);
        }
        for (const [key, value] of Object.entries(mail.bodyVariable || {})) {
          templateMail.body = templateMail.body.replaceAll(`{${key}}`, value);
        }
        newMail.subject = templateMail.title;
        newMail.html = templateMail.body;
      }

      return newMail;
    } catch (error) {
      logger.error(error);
      throw error;
    }

  }

  async createAndSendMail(mailData: Mail): Promise<void> {
    try {
      if (!mailData.to) {
        throw new Error("Email, manca il destinatario");
      }
      let mailDao = new MailDao(db);
      const mail = new Mail(mailData);
      const createdMail = await mailDao.createMail(mail);
      await this.sendMailId(mail.id!);
    } catch (error) {
      logger.error(error);
      throw error;
    }
  }
  async sendMail(newMail: Mail): Promise<boolean> {
    let mailSended = false;
    try {
      let mailDao = new MailDao(db);
      let attempts = 0;

      let id = newMail.id;
      if (id) {
        do {
          debugger
          logger.info("Sending email id: " + id+ " try: " + attempts);
          try {
            let res = await this.nodemailer.sendMail(newMail);
            if (res.accepted && res.accepted.length > 0) {
              mailSended = true;
              mailDao.updateTry(id, true);
            } else {
              throw new Error("Failed to send email id: " + id);
            }

          } catch (error:any) {
            attempts++;
            mailSended = false;
            mailDao.updateTry(id, false);
            logger.error(error.message);
            if (attempts < 3) {
              await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
              logger.error("Failed to send email after 3 attempts email id: " + id);
            }
          }
        } while (!mailSended && attempts < 3);
      }
      else { throw new Error("Email, manca l'id"); }

    } catch (error: any) {
      throw new Error(error?.message || "Failed to send email");
    }
    return mailSended

  }
  async sendMailId(id: string) {

    try {
      if (!mailConfig) {
        throw new Error("Email, manca la configurazione");
      }
      try {
        this.nodemailer = await nodemailer.createTransport(mailConfig)
      } catch (error) {
        logger.error("Impossibile creare il trasporto nodemailer");
       
      }
      if (!id) {
        throw new Error("Email,Manca l'id");
      }
      let mailDao = new MailDao(db);
      const mail = await mailDao.readMailById(id);
      const newMail = await this.templateParser(mail);

      if (!newMail) {
        throw new Error("Email, manca il template");
      }



    } catch (error) {
    
      throw error;
    }
  }

}

export default MailService;

