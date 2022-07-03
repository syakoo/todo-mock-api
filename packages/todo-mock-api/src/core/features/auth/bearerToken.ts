import { ValidateError } from '~/utils/customError';
import { assertValidToken } from '~/core/features/user';

export function checkAndGetBearerToken(value: string | null): string {
  if (typeof value !== 'string') {
    throw new ValidateError(
      'bearer token が文字列ではありません。設定されていない可能性があります。',
      'bearer token が正しい値ではありません'
    );
  }

  const regexBearerToken = /Bearer\s+(?<token>\S*)/;
  const matchedToken = value.match(regexBearerToken);
  const token = matchedToken?.groups?.token;

  if (!token) {
    throw new ValidateError(
      'token が見つかりませんでした。',
      'bearer token が正しい値ではありません'
    );
  }
  assertValidToken(token);

  return token;
}
