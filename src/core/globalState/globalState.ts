import { assertValidUserState } from '~/core/features/user/validator';

import type { TaskState } from '~/core/features/task';
import type { UserState } from '~/core/features/user';
import type { UnknownRecord } from '~/utils/types';

export interface GlobalState {
  users: UserState[];
  tasks: TaskState[];
}

export const defaultGlobalState: GlobalState = {
  users: [
    {
      username: 'guest',
      password: 'password',
      id: 'GUEST_ID',
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
      assertValidUserState(user);
    }
  } catch (error) {
    console.error(error);
    return false;
  }

  return true;
}
