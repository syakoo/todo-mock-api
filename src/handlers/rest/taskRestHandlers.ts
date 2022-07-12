import { rest } from 'msw';

import * as taskFeature from '~/core/features/task';
import * as tokenFeature from '~/core/features/token';

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

    rest.get('/api/tasks/:taskId', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authentication'),
          },
        });
        taskFeature.assertValidTaskId(req.params.taskId);

        const result = await taskFeature.getTask({
          state: globalStorage.globalState,
          input: {
            user,
            id: req.params.taskId,
          },
        });
        const task = result.output.task;

        return res(ctx.status(200), ctx.json(task));
      } catch (error) {
        const response = error2HttpErrorResponse(error);
        return res(ctx.status(response.status), ctx.json(response.body));
      }
    }),

    rest.patch<UnknownRecord>('/api/tasks/:taskId', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authentication'),
          },
        });
        taskFeature.assertValidTaskId(req.params.taskId);
        const incomingPartialTask = {
          title: req.body.title,
          detail: req.body.detail,
        };
        taskFeature.assertValidIncomingPartialTask(incomingPartialTask);

        const result = await taskFeature.updateTask({
          state: globalStorage.globalState,
          input: {
            user,
            id: req.params.taskId,
            incomingPartialTask,
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

    rest.delete('/api/tasks/:taskId', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authentication'),
          },
        });
        taskFeature.assertValidTaskId(req.params.taskId);

        const result = await taskFeature.deleteTask({
          state: globalStorage.globalState,
          input: {
            user,
            id: req.params.taskId,
          },
        });

        globalStorage.updateGlobalState(result.state);
        return res(ctx.status(200), ctx.json({ success: true }));
      } catch (error) {
        const response = error2HttpErrorResponse(error);
        return res(ctx.status(response.status), ctx.json(response.body));
      }
    }),

    rest.put('/api/tasks/:taskId/completion', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authentication'),
          },
        });
        taskFeature.assertValidTaskId(req.params.taskId);

        const result = await taskFeature.updateTaskCompletion({
          state: globalStorage.globalState,
          input: {
            user,
            id: req.params.taskId,
            isComplete: true,
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

    rest.delete('/api/tasks/:taskId/completion', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authentication'),
          },
        });
        taskFeature.assertValidTaskId(req.params.taskId);

        const result = await taskFeature.updateTaskCompletion({
          state: globalStorage.globalState,
          input: {
            user,
            id: req.params.taskId,
            isComplete: false,
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
