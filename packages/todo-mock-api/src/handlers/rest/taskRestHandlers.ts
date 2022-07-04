import { rest } from 'msw';

import * as authFeature from '~/core/features/auth';
import * as taskFeature from '~/core/features/task';
import { HttpError } from '~/utils/httpError';

import type { GlobalStorage } from '~/core/globalState/globalStorage';

export function createUserRestHandlers(globalStorage: GlobalStorage) {
  const taskRestHandlers = [
    rest.get('/api/tasks', async (req, res, ctx) => {
      let tasks: taskFeature.Task[];
      try {
        const authResult = await authFeature.authenticateToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authentication'),
          },
        });

        const result = await taskFeature.getTasks({
          state: globalStorage.globalState,
          input: {
            user: authResult.output.user,
          },
        });
        tasks = result.output.tasks;
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

      return res(ctx.status(200), ctx.json(tasks));
    }),
  ];

  return taskRestHandlers;
}
