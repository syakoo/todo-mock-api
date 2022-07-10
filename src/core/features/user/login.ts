import { Base64 } from 'js-base64';

import { deepCopyWithWriteable } from '~/utils/deepCopy';

import { UserError } from './error';

import type { WithDBStateReadonlyInput } from '~/core/types';
import type { GlobalState } from '~/core/globalState';

interface LoginUserInput {
  username: string;
  password: string;
}

interface LoginUserReturn {
  state: GlobalState;
  outputs: {
    token: string;
  };
}

export async function loginUser(
  props: WithDBStateReadonlyInput<LoginUserInput>
): Promise<LoginUserReturn> {
  const { input, state } = props;
  const newState = deepCopyWithWriteable(state);

  const targetUser = state.users.find((u) => u.username === input.username);
  if (!targetUser) {
    throw new UserError(
      `ユーザー ${input.username} が存在しません`,
      'UserNotFound'
    );
  }

  if (targetUser.password !== input.password) {
    throw new UserError(
      `ユーザー ${input.username} は見つかりましたが、パスワード ${input.password} が正しくありません`,
      'MismatchedPassword'
    );
  }

  const token = Base64.encode(
    JSON.stringify({
      user: input.username,
      date: new Date(),
    })
  );
  newState.users.forEach((user) => {
    if (user.username === input.username) {
      user.token = token;
    }
  });

  return {
    state: newState,
    outputs: {
      token,
    },
  };
}
