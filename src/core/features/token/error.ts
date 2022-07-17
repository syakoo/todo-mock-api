import { CustomError } from '~/utils/customError';

export type TokenErrorCode =
  | 'InvalidToken'
  | 'MismatchedToken'
  | 'TokenRequired';

export class TokenError extends CustomError<TokenErrorCode> {}
