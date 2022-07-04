import { ValidateError } from '~/utils/customError';
import { isUnknownRecord } from '~/utils/validator';
import { assertValidToken } from '~/core/features/auth';

import { UserState } from './types';

export function assertValidUserName(
  username: unknown
): asserts username is string {
  if (typeof username !== 'string') {
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

  assertValidUserName(state.username);
  assertValidPassword(state.password);
  assertValidToken(state.token);
}
