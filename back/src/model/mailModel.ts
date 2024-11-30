import { Guid } from "guid-typescript";
export interface MailModel {
    to: string;
    title?: string;
    message?: string;
    createdAt?: number;
    lastTry?: number | undefined;
    tryNumber?: number;
    type: string;
    sended?: boolean;
    id?: string;
    titleVariable?: { [key: string]: string }
    bodyVariable?: { [key: string]: string }
}

export class Mail implements MailModel {
    public to: string;
    public title?: string;
    public message?: string;
    public createdAt?: number;
    public lastTry?: number | undefined;
    public tryNumber?: number;
    public sended?: boolean;
    public id?: string;
    public type: string;
    public titleVariable?: { [key: string]: string }
    public bodyVariable?: { [key: string]: string }
    constructor(mail: any) {
        if (!mail.to) {
            throw new Error("Manca il destinatario");
        }

        this.id = mail.id || Guid.create().toString();
        this.to = mail.to;
        this.title = mail.title;
        this.message = mail.message;
        if (!mail.id) {
            this.createdAt = new Date().getTime();
            this.lastTry = undefined;
            this.tryNumber = 0;
        }
        this.titleVariable = mail.titleVariable || {};
        this.bodyVariable = mail.bodyVariable || {};

        this.type = mail.type || "default";
        this.sended = false;
    }
}

