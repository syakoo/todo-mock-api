import { rest } from 'msw';

import * as user from '~/core/user';
import { assertValidPassword, assertValidUser } from '~/validators';
import { ValidateError } from '~/validators/validateError';
import { CustomError } from '~/utils/customError';
import { UnknownRecord } from '~/utils/types';

import { HttpError } from '../utils/httpError';
import { GlobalState } from '../core/types';

let state: GlobalState = { users: [], tasks: [] };

export const restHandlers = [
  rest.get('/api/user', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json('Hello World'));
  }),
  rest.post<UnknownRecord>('/api/users/register', (req, res, ctx) => {
    try {
      assertValidUser(req.body.user);
      assertValidPassword(req.body.password);
    } catch (error) {
      if (error instanceof ValidateError) {
        res(ctx.status(400), ctx.body(error.toJson()));
      }

      const err = new CustomError(
        'バリデーション時に意図しないエラーが発生しました',
        'ユーザー名またはパスワードが無効な値です'
      );
      res(ctx.status(400), ctx.body(err.toJson()));
      return;
    }

    try {
      const userInfo = {
        user: req.body.user,
        password: req.body.password,
      };

      const result = user.registerUser({ input: userInfo, state });
      state = result;
    } catch (error) {
      if (error instanceof HttpError) {
        res(ctx.status(error.code), ctx.body(error.toJson()));
      }

      const err = new HttpError(
        500,
        '処理時に予期しないエラーが発生しました',
        'サーバー内でエラーが発生しました'
      );
      res(ctx.status(err.code), ctx.body(err.toJson()));
    }
  }),
];
