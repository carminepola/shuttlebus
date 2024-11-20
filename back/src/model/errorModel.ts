export default class ErrorModel {
  code: number;
  stack: string | undefined;
  message: string;
  errors: any;
  constructor(message: string, code?: number, stack?: string, errors?: any) {
    this.code = code || 500;
    this.stack = stack || undefined;
    this.message = message || "Errore non gestito";
    this.errors = errors || undefined;
  }
}
