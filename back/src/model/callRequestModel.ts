import { IncomingHttpHeaders } from "http";

export default class CallRequest {
  date: string;
  ip: string;
  method: string;
  url: string;
  header: IncomingHttpHeaders;
  body: any;
  uniqueCallKey: string;
  version: string;
  clientCallKey: string | undefined;
  clientSid: string;
  session?: string;
  constructor(clientSid: string, ip: string, uniqueCallKey: string, method: string, url: string, header: IncomingHttpHeaders, version: string, clientCallKey: string, session?: string) {
    this.date = new Date().toString();
    this.ip = ip ? ip : "";
    this.clientSid = clientSid ? clientSid : "";
    this.clientCallKey = clientCallKey;
    this.method = method;
    this.url = url;
    this.header = header;
    this.uniqueCallKey = uniqueCallKey;
    this.body = undefined;
    this.version = version;
    this.session = session;
  }
}
