import { rest } from 'msw';

import * as tokenFeature from '~/core/features/token';
import * as taskFeature from '~/core/features/task';

import { error2HttpErrorResponse } from './error';

import type { GlobalStorage } from '~/core/globalState/globalStorage';
import type { UnknownRecord } from '~/utils/types';

export function createUserRestHandlers(globalStorage: GlobalStorage) {
  const taskRestHandlers = [
    rest.get('/api/tasks', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authentication'),
          },
        });

        const result = await taskFeature.getTasks({
          state: globalStorage.globalState,
          input: {
            user,
          },
        });
        const tasks = result.output.tasks;

        return res(ctx.status(200), ctx.json(tasks));
      } catch (error) {
        const response = error2HttpErrorResponse(error);
        return res(ctx.status(response.status), ctx.json(response.body));
      }
    }),

    rest.post<UnknownRecord>('/api/tasks', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authentication'),
          },
        });

        taskFeature.assertValidTaskTitle(req.body.title);
        taskFeature.assertValidTaskDetail(req.body.detail);

        const inputTask = {
          title: req.body.title,
          detail: req.body.detail,
        };

        const result = await taskFeature.addTask({
          state: globalStorage.globalState,
          input: {
            user: user,
            task: inputTask,
          },
        });
        const task = result.output.task;
        globalStorage.updateGlobalState(result.state);

        return res(ctx.status(200), ctx.json(task));
      } catch (error) {
        const response = error2HttpErrorResponse(error);
        return res(ctx.status(response.status), ctx.json(response.body));
      }
    }),
  ];

  return taskRestHandlers;
}
