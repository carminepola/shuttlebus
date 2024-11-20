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
  constructor(
    ip: string,
    uniqueCallKey: string,
    method: string,
    url: string,
    header: IncomingHttpHeaders,
    version: string,
    clientcallkey: string,
    body?: string
  ) {
    this.date = new Date().toISOString();
    this.ip = ip ? ip : "";
    this.clientcallkey = clientcallkey;
    this.method = method;
    this.url = url;
    this.header = header;
    this.uniqueCallKey = uniqueCallKey;
    this.body = body ? body : undefined;
    this.version = version;
  }
}
