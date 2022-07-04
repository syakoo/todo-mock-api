import { deepCopyWithWriteable } from '~/utils/deepCopy';

import type { GlobalState } from '~/core/globalState';
import type { WithDBStateReadonlyInput } from '~/core/types';
import type { UserState } from './types';

interface LogoutUserInput {
  user: UserState;
}

export async function logoutUser(
  props: WithDBStateReadonlyInput<LogoutUserInput>
): Promise<GlobalState> {
  const { state, input } = props;
  const newState = deepCopyWithWriteable(state);

  newState.users.forEach((user) => {
    if (user.id === input.user.id) {
      delete user.token;
    }
  });

  return newState;
}
