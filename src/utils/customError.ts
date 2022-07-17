export type CommonErrorCode = 'ValidateError' | 'UnexpectedError';

/**
 * エラークラス
 */
export class CustomError<T extends string = string> extends Error {
  code: T | CommonErrorCode;

  constructor(message: string, code: T | CommonErrorCode) {
    super(message);
    // 開発者用のエラーメッセージ
    this.message = message;
    // アプリのエラーコード
    this.code = code;
  }

  toJson() {
    return {
      code: this.code,
      message: this.message,
    };
  }
}
