import { deepCopyWithWriteable } from '~/utils/deepCopy';
import { sha256 } from '~/utils/sha256';

import { UserError } from './error';

import type { WithDBStateReadonlyInput } from '../../types';
import type { GlobalState } from '~/core/globalState';

interface RegisterUserInput {
  username: string;
  password: string;
}

export async function registerUser(
  props: WithDBStateReadonlyInput<RegisterUserInput>
): Promise<GlobalState> {
  const { input, state } = props;
  const newState = deepCopyWithWriteable(state);

  if (state.users.filter((u) => u.username === input.username).length > 0) {
    throw new UserError(
      `ユーザー ${input.username} は既に登録されています`,
      'ConflictUser'
    );
  }

  const id = await sha256(input.username);
  newState.users.push({
    username: input.username,
    password: input.password,
    id,
  });

  return newState;
}
