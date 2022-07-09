/**
 * エラークラス、エラーメッセージが確認用と表示用で分かれている。
 */
export class CustomError extends Error {
  display_message: string;

  constructor(message: string, display_message?: string) {
    super(message);
    // 開発者用のエラーメッセージ
    this.message = message;
    // 表示用のエラーメッセージ
    this.display_message = display_message || message;
  }

  toJson() {
    return {
      message: this.message,
      display_message: this.display_message,
    };
  }
}

/**
 * validation 時のエラー、これ以外は 500 で返すことにする
 */
export class ValidateError extends CustomError {
  constructor(message: string, display_message: string) {
    super(message, display_message);
  }
}
