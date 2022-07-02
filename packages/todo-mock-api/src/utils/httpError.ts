import { CustomError } from './customError';

/**
 * HTTP 用のエラー
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
