export default class ErrorModel {
  code?: number;
  stack: string | undefined;
  message: string | undefined;
  errors: any;
  constructor(code: number, message?: string, stack?: string, errors?: any) {
    this.code = code;

    this.stack = stack || undefined;
    this.errors = errors || undefined;

    this.message = message || undefined;

    if (!message) {
      switch (this.code) {
        case 400:
          this.message = "Bad Request";
          break;
        case 401:
          this.message = "Unauthorized";
          break;
        case 403:
          this.message = "Forbidden";
          break;
        case 404:
          this.message = "Not Found";
          break;
        case 405:
          this.message = "Method Not Allowed";
          break;
        case 406:
          this.message = "Not Acceptable";
          break;
        case 409:
          this.message = "Conflict";
          break;
        case 410:
          this.message = "Gone";
          break;
        case 413:
          this.message = "Payload Too Large";
          break;
        case 415:
          this.message = "Unsupported Media Type";
          break;
        case 429:
          this.message = "Too Many Requests";
          break;
        case 500:
          this.message = "Internal Server Error";
          break;
        default:
          this.message = "Internal Server Error";
          break;
      }
    }
  }
}
