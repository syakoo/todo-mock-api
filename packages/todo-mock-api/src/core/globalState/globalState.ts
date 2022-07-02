import {
  assertValidUser,
  assertValidPassword,
} from '~/core/features/user/validator';

import type { UnknownRecord } from '~/utils/types';
import type { UserState } from '~/core/features/user';

export interface GlobalState {
  users: UserState[];
  tasks: [];
}

export const defaultGlobalState: GlobalState = {
  users: [
    {
      user: 'guest',
      password: 'password',
    },
  ],
  tasks: [],
};

export function isValidGlobalState(state: UnknownRecord | null): boolean {
  if (!state) return false;
  if (typeof state !== 'object') return false;
  if (!Array.isArray(state.users)) return false;
  if (!Array.isArray(state.tasks)) return false;

  try {
    for (const user of state.users) {
      assertValidUser(user.user);
      assertValidPassword(user.password);
    }
  } catch {
    return false;
  }

  return true;
}
