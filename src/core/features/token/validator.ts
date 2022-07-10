import { TokenError } from './error';

export function assertValidToken(
  token: unknown
): asserts token is string | undefined {
  if (token === undefined) return;

  if (typeof token !== 'string') {
    throw new TokenError('トークンが文字列ではありません', 'InvalidToken');
  }

  if (!/^[0-9a-zA-Z-._~+/]+=*$/.test(token)) {
    throw new TokenError(
      'トークンは token68 の形式である必要があります',
      'InvalidToken'
    );
  }
}

export function checkAndGetBearerToken(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TokenError(
      'bearer token が文字列ではありません。設定されていない可能性があります。',
      'InvalidToken'
    );
  }

  const regexBearerToken = /Bearer\s+(?<token>\S*)/;
  const matchedToken = value.match(regexBearerToken);
  const token = matchedToken?.groups?.token;

  if (!token) {
    throw new TokenError('token が見つかりませんでした。', 'InvalidToken');
  }
  assertValidToken(token);

  return token;
}
