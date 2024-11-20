import ErrorResponse from "./errorModel";

export default class MessageModel {
  public object?: any;

  public error?: ErrorResponse;

  public message?: any;

  public uniqueCallKey?: string;

  public version?: string;

  public clientCallKey?: string | undefined;

  constructor(uniqueCallKey: string, clientCallKey?: string) {
    this.object = undefined;
    this.error = undefined;
    this.message = undefined;
    this.version = undefined;
    this.uniqueCallKey = uniqueCallKey;
    this.clientCallKey = clientCallKey;
  }
}
