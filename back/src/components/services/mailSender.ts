import { Db } from "mongodb";
import MailService from "./mailServices";
import { Mail } from "../../model/mailModel";
class MailSenderServices {
  private mailService: MailService;

  constructor(db: Db) {
    this.mailService = new MailService(db);
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
