import { HttpError } from '~/utils/httpError';
import { deepCopyWithWriteable } from '~/utils/deepCopy';

import { checkAndGetBearerToken } from './validator';

import type { WithDBStateReadonlyInput } from '~/core/types';
import type { UserState } from '~/core/features/user';

interface AuthenticateTokenInput {
  maybeBearerToken: string | null;
}

interface AuthenticateTokenReturn {
  output: {
    user: UserState;
  };
}

export async function authenticateToken(
  props: WithDBStateReadonlyInput<AuthenticateTokenInput>
): Promise<AuthenticateTokenReturn> {
  const { input, state } = props;
  const cloneState = deepCopyWithWriteable(state);

  if (input.maybeBearerToken === null) {
    throw new HttpError(
      401,
      'リスエストヘッダに Authorization が存在しません',
      'トークンが必須です'
    );
  }

  let token: string;
  try {
    token = checkAndGetBearerToken(input.maybeBearerToken);
  } catch (error) {
    console.error(error);
    throw new HttpError(
      400,
      `トークンのバリデーションに失敗しました`,
      'トークンが不正な値です'
    );
  }

  const user = cloneState.users.find((u) => u.token === token);
  if (!user) {
    throw new HttpError(
      401,
      'トークンの値に該当するユーザーが見つかりませんでした',
      'トークンの値が無効です'
    );
  }

  return {
    output: {
      user,
    },
  };
}
