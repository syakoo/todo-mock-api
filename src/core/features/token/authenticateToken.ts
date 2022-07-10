import { deepCopyWithWriteable } from '~/utils/deepCopy';

import { checkAndGetBearerToken } from './validator';
import { TokenError } from './error';

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
    throw new TokenError(
      'リスエストヘッダに Authorization が存在しません',
      'TokenRequired'
    );
  }

  const token = checkAndGetBearerToken(input.maybeBearerToken);

  const user = cloneState.users.find((u) => u.token === token);
  if (!user) {
    throw new TokenError(
      'トークンの値に該当するユーザーが見つかりませんでした',
      'MismatchedToken'
    );
  }

  return {
    output: {
      user,
    },
  };
}
