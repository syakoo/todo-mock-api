import { ValidateError } from '~/utils/customError';

export function assertValidToken(
  token: unknown
): asserts token is string | undefined {
  if (token === undefined) return;

  if (typeof token !== 'string') {
    throw new ValidateError(
      '`token` が文字列ではありません',
      'トークンの値が無効です'
    );
  }

  if (!/^[0-9a-zA-Z-._~+/]+=*$/.test(token)) {
    throw new ValidateError(
      '`token` は token68 の形式である必要があります',
      'トークンの値が無効です'
    );
  }
}

export function checkAndGetBearerToken(value: unknown): string {
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
