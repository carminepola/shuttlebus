import { Db } from "mongodb";
import MailService from "./mailServices";
import { Mail } from "../../model/mailModel";
class MailSenderServices {
  private mailService: MailService;

  constructor(db: Db) {
    this.mailService = new MailService(db);
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
}

export default MailSenderServices;
