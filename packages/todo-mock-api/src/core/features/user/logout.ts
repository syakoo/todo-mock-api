import { deepCopyWithWriteable } from '~/utils/deepCopy';

import type { GlobalState } from '~/core/globalState';
import type { WithDBStateReadonlyInput } from '~/core/types';

interface LogoutUserInput {
  token: string;
}

export async function logoutUser(
  props: WithDBStateReadonlyInput<LogoutUserInput>
): Promise<GlobalState> {
  const { state, input } = props;
  const newState = deepCopyWithWriteable(state);

  newState.users.forEach((user) => {
    if (user.token === input.token) {
      delete user.token;
    }
  });

  return newState;
}
