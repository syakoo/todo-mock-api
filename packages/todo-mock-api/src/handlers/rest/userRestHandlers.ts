import { rest } from 'msw';

import { GlobalStorage } from '~/core/globalState/globalStorage';
import * as user from '~/core/features/user';
import { CustomError, ValidateError } from '~/utils/customError';
import { HttpError } from '~/utils/httpError';
import { UnknownRecord } from '~/utils/types';

export function createUserRestHandlers(globalStorage: GlobalStorage) {
  const userRestHandlers = [
    rest.post<UnknownRecord>('/api/users/register', (req, res, ctx) => {
      try {
        user.assertValidUser(req.body.user);
        user.assertValidPassword(req.body.password);
      } catch (error) {
        if (error instanceof ValidateError) {
          return res(ctx.status(400), ctx.json(error.toJson()));
        }

        const err = new CustomError(
          'バリデーション時に意図しないエラーが発生しました',
          'ユーザー名またはパスワードが無効な値です'
        );
        return res(ctx.status(400), ctx.json(err.toJson()));
      }

      try {
        const userInfo = {
          user: req.body.user,
          password: req.body.password,
        };

        const result = user.registerUser({
          input: userInfo,
          state: globalStorage.globalState,
        });
        globalStorage.updateGlobalState(result);
      } catch (error) {
        if (error instanceof HttpError) {
          return res(ctx.status(error.code), ctx.json(error.toJson()));
        }

        const err = new HttpError(
          500,
          '処理時に予期しないエラーが発生しました',
          'サーバー内でエラーが発生しました'
        );
        return res(ctx.status(err.code), ctx.json(err.toJson()));
      }

      return res(
        ctx.status(200),
        ctx.json({
          success: true,
        })
      );
    }),
  ];

  return userRestHandlers;
}