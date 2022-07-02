import { deepCopyWithWriteable } from '~/utils/deepCopy';
import { HttpError } from '~/utils/httpError';

import type { GlobalState } from '~/core/globalState';
import type { WithDBStateReadonlyInput } from '../types';

interface RegisterUserInput {
  user: string;
  password: string;
}

export function registerUser(
  props: WithDBStateReadonlyInput<RegisterUserInput>
): GlobalState {
  const { input, state } = props;
  const newState = deepCopyWithWriteable(state);

  if (state.users.filter((u) => u.user === input.user).length > 0) {
    throw new HttpError(
      409,
      `ユーザー ${input.user} は既に登録されています`,
      '既に同じユーザーが存在します'
    );
  }

  newState.users.push({
    user: input.user,
    password: input.password,
  });

  return newState;
}
