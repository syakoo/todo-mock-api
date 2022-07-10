import { isUnknownRecord } from '~/utils/validator';
import { assertValidToken } from '~/core/features/token';

import { UserError } from './error';

import type { UserState, User } from './types';
import type { UnknownRecord } from '~/utils/types';

export function assertValidUserName(
  username: unknown
): asserts username is string {
  if (typeof username !== 'string') {
    throw new UserError('ユーザー名が文字列ではありません', 'InvalidUser');
  }
}

export function assertValidPassword(
  password: unknown
): asserts password is string {
  if (typeof password !== 'string') {
    throw new UserError('パスワードが文字列ではありません', 'InvalidUser');
  }
}

export function assertValidUserId(
  maybeUserId: unknown
): asserts maybeUserId is string {
  if (typeof maybeUserId !== 'string') {
    throw new UserError('ユーザー ID が文字列ではありません', 'InvalidUser');
  }
}

export function assertValidUser(state: unknown): asserts state is User {
  if (!isUnknownRecord(state)) {
    throw new UserError('ユーザーの値が無効です', 'InvalidUser');
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
