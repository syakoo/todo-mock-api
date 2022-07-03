import { ValidateError } from '~/utils/customError';
import { isUnknownRecord } from '~/utils/validator';
import { assertValidToken } from '~/core/features/auth';

import { UserState } from './types';

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

export function assertValidUserState(
  state: unknown
): asserts state is UserState {
  if (!isUnknownRecord(state)) {
    throw new ValidateError(
      `${state} はオブジェクト型ではありません`,
      'ユーザーの値が無効です'
    );
  }

  assertValidUser(state.user);
  assertValidUser(state.password);
  assertValidToken(state.token);
}
