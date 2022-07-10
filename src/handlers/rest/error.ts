import { type CommonErrorCode, CustomError } from '~/utils/customError';

import type { UserErrorCode } from '~/core/features/user';
import type { UnknownRecord } from '~/utils/types';
import type { TokenErrorCode } from '~/core/features/token';
import type { TaskErrorCode } from '~/core/features/task/error';

export type AppErrorCode =
  | CommonErrorCode
  | UserErrorCode
  | TokenErrorCode
  | TaskErrorCode;

export interface HTTPErrorResponse {
  status: number;
  body: UnknownRecord;
}

export function error2HttpErrorResponse(error: unknown): HTTPErrorResponse {
  if (!(error instanceof CustomError)) {
    return {
      status: 500,
      body: {
        code: 'UnexpectedError',
        message: 'サーバー内で予期しないエラーが発生しました',
      },
    };
  }

  // NOTE: うまい方法が思いつかんかった
  switch (error.code as AppErrorCode) {
    // user
    case 'InvalidUser':
      return {
        status: 400,
        body: error.toJson(),
      };
    case 'MismatchedPassword':
      return {
        status: 401,
        body: error.toJson(),
      };
    case 'UserNotFound':
      return {
        status: 404,
        body: error.toJson(),
      };
    case 'ConflictUser':
      return {
        status: 409,
        body: error.toJson(),
      };

    // token
    case 'InvalidToken':
      return {
        status: 400,
        body: error.toJson(),
      };
    case 'MismatchedToken':
      return {
        status: 401,
        body: error.toJson(),
      };
    case 'TokenRequired':
      return {
        status: 401,
        body: error.toJson(),
      };

    // task
    case 'InvalidTask':
      return {
        status: 400,
        body: error.toJson(),
      };
    case 'TaskNotFound':
      return {
        status: 404,
        body: error.toJson(),
      };

    // default
    case 'ValidateError':
      return {
        status: 400,
        body: error.toJson(),
      };
    case 'UnexpectedError':
      return {
        status: 500,
        body: error.toJson(),
      };
  }
}
