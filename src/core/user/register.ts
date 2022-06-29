import { deepCopyWithWriteable } from '~/utils/deepCopy';

import { GlobalState, WithDBStateReadonlyInput } from '../types';
import { HttpError } from '../../utils/httpError';

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
    throw new HttpError(409, '既に同じユーザーが存在します');
  }

  newState.users.push({
    user: input.user,
    password: input.password,
  });

  return newState;
}
