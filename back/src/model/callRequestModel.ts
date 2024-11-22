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
  clientcallkey: string | undefined;
  session?: string
  constructor(
    ip: string,
    uniqueCallKey: string,
    method: string,
    url: string,
    header: IncomingHttpHeaders,
    version: string,
    clientcallkey: string,
    session?: string,


  ) {
    this.date = new Date().toISOString();
    this.ip = ip ? ip : "";
    this.clientcallkey = clientcallkey;
    this.method = method;
    this.url = url;
    this.header = header;
    this.uniqueCallKey = uniqueCallKey;
    this.body = undefined;
    this.version = version;
    this.session = session
  }
}
