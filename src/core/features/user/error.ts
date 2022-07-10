import { CustomError } from '~/utils/customError';

export type UserErrorCode =
  | 'ConflictUser'
  | 'InvalidUser'
  | 'MismatchedPassword'
  | 'UserNotFound';

export class UserError extends CustomError<UserErrorCode> {}
