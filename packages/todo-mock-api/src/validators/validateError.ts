import { CustomError } from '~/utils/customError';

/**
 * validation 時のエラー、これ以外は 500 で返すことにする
 */
export class ValidateError extends CustomError {
  constructor(message: string, display_message: string) {
    super(message, display_message);
  }
}
