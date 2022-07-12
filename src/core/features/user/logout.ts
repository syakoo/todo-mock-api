import { deepCopyWithWriteable } from '~/utils/deepCopy';

import type { UserState } from './types';
import type { GlobalState } from '~/core/globalState';
import type { WithDBStateReadonlyInput } from '~/core/types';

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
