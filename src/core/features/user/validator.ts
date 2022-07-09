import { ValidateError } from '~/utils/customError';
import { isUnknownRecord } from '~/utils/validator';
import { assertValidToken } from '~/core/features/auth';

import type { UserState, User } from './types';
import type { UnknownRecord } from '~/utils/types';

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

export function assertValidUserId(
  maybeUserId: unknown
): asserts maybeUserId is string {
  if (typeof maybeUserId !== 'string') {
    throw new ValidateError(
      'ユーザー ID が文字列ではありません',
      'ユーザー情報が正しい値ではありません'
    );
  }
}

export function assertValidUser(state: unknown): asserts state is User {
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

export function assertValidUserState(
  state: unknown
): asserts state is UserState {
  assertValidUser(state);
  assertValidUserId((state as unknown as UnknownRecord).id);
}
