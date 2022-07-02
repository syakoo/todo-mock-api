import { CustomError } from './customError';

/**
 * Http 用のエラー、これ以外は 500 で返すことにする
 */
export class HttpError extends CustomError {
  code: number;

  constructor(code: number, message: string, display_message: string) {
    super(message, display_message);
    this.code = code;
  }

  toJson() {
    return {
      code: this.code,
      message: this.message,
      display_message: this.display_message,
    };
  }
}
