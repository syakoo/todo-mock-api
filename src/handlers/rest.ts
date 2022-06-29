import { rest } from 'msw';

import * as user from '~/core/user';

import { HttpError } from '../utils/httpError';
import { DBState } from '../core/types';

let state: DBState = { users: [], tasks: [] };

export const restHandlers = [
  rest.get('/api/user', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json('Hello World'));
  }),
  rest.post<{ user: string; password: string }>(
    '/api/users/register',
    (req, res, ctx) => {
      try {
        // TODO: バリデーションをする
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

        const err = new HttpError(500, 'サーバー内でエラーが発生しました');
        res(ctx.status(err.code), ctx.body(err.toJson()));
      }
    }
  ),
];
