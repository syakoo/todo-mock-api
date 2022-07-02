import { ValidateError } from '~/utils/customError';

export function assertValidUser(user: unknown): asserts user is string {
  if (typeof user !== 'string') {
    throw new ValidateError(
      '`user` が文字列ではありません',
      'ユーザー名の値が無効です'
    );
  }
}

export function assertValidPassword(
  password: unknown
): asserts password is string {
  if (typeof password !== 'string') {
    throw new ValidateError(
      '`password` が文字列ではありません',
      'パスワードの値が無効です'
    );
  }
}
