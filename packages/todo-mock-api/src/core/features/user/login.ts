import { deepCopyWithWriteable } from '~/utils/deepCopy';
import { HttpError } from '~/utils/httpError';
import { sha256 } from '~/utils/sha256';

import type { WithDBStateReadonlyInput } from '~/core/types';
import type { GlobalState } from '~/core/globalState';

interface LoginUserInput {
  user: string;
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

  const targetUser = state.users.find((u) => u.user === input.user);
  if (!targetUser) {
    throw new HttpError(
      404,
      `ユーザー ${input.user} が存在しません`,
      '該当するユーザーが見つかりませんでした'
    );
  }

  if (targetUser.password !== input.password) {
    throw new HttpError(
      401,
      `ユーザー ${input.user} は見つかりましたが、パスワード ${input.password} が正しくありません`,
      'ユーザー名もしくはパスワードが間違えています。もう一度入力してください。'
    );
  }

  const token = await sha256(`${input.user}:${input.password}`);
  newState.users.map((user) => {
    if (user.user !== input.user) return user;

    return {
      ...user,
      token,
    };
  });

  return {
    state: newState,
    outputs: {
      token,
    },
  };
}
