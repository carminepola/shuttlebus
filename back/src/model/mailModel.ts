import nodemailer from "nodemailer";
import { Guid } from "guid-typescript";

export interface MailModel {
  to: string;
  title?: string;
  message?: string;
  createdAt?: number;
  lastTry?: number;
  tryNumber?: number;
  type: string;
  sended?: boolean;
  id: string;
  titleVariables?: { [key: string]: string };
  bodyVariables?: { [key: string]: string };
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
    cid?: string;
  }>;
}

export class Mail implements MailModel {
  public to: string;
  public title?: string;
  public message?: string;
  public createdAt?: number;
  public lastTry?: number;
  public tryNumber?: number;
  public sended?: boolean;
  public id: string;
  public type: string;
  public titleVariables?: { [key: string]: string };
  public bodyVariables?: { [key: string]: string };
  public cc?: string[];
  public bcc?: string[];
  public attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
    cid?: string;
  }>;
  constructor(mail: any) {
    if (!mail.to) {
      throw new Error("Manca il destinatario");
    }

    this.id = mail.id || Guid.create().toString();
    this.to = mail.to;
    this.title = mail.title;
    this.message = mail.message;
    this.cc = mail.cc;
    this.bcc = mail.bcc;
    this.attachments = mail.attachments;
    if (!mail.id) {
      this.createdAt = new Date().getTime();
      this.lastTry = undefined;
      this.tryNumber = 0;
    }

    this.titleVariables = mail.titleVariables || {};
    this.bodyVariables = mail.bodyVariables || {};

    this.type = mail.type || "default";
    this.sended = false;
  }
}
