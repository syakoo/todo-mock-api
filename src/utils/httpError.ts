/**
 * Http 用のエラー、これ以外は 500 で返すことにする
 */
export class HttpError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    this.message = message;
  }
}
