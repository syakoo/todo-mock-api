import { rest, type DefaultBodyType, type PathParams } from 'msw';

import * as taskFeature from '~/core/features/task';
import * as tokenFeature from '~/core/features/token';

import { error2HttpErrorResponse, type AppApiError } from './error';

import type { RestHandlersCreator } from './types';
import type { GlobalStorage } from '~/core/globalState/globalStorage';

// __________
// /api/tasks
export interface ApiTasks {
  get: {
    resBody: taskFeature.Task[];
  };
  post: {
    reqBody: {
      title: string;
      detail?: string;
    };
    resBody: taskFeature.Task;
  };
}

const createTasksHandlers: RestHandlersCreator = (globalStorage) => {
  return [
    rest.get<
      DefaultBodyType,
      PathParams,
      ApiTasks['get']['resBody'] | AppApiError
    >('/api/tasks', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authorization'),
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

    rest.post<
      ApiTasks['post']['reqBody'],
      PathParams,
      ApiTasks['post']['resBody'] | AppApiError
    >('/api/tasks', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authorization'),
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
};

// __________
// /api/tasks/:taskId
export interface ApiTasksId {
  params: {
    taskId: string;
  };
  get: {
    resBody: taskFeature.Task;
  };
  patch: {
    reqBody: {
      title?: string;
      detail?: string;
    };
    resBody: taskFeature.Task;
  };
  delete: {
    resBody: {
      success: boolean;
    };
  };
}

const createTasksIdHandlers: RestHandlersCreator = (globalStorage) => {
  return [
    rest.get<
      DefaultBodyType,
      ApiTasksId['params'],
      ApiTasksId['get']['resBody'] | AppApiError
    >('/api/tasks/:taskId', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authorization'),
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

    rest.patch<
      ApiTasksId['patch']['reqBody'],
      ApiTasksId['params'],
      ApiTasksId['patch']['resBody'] | AppApiError
    >('/api/tasks/:taskId', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authorization'),
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

    rest.delete<
      DefaultBodyType,
      ApiTasksId['params'],
      ApiTasksId['delete']['resBody'] | AppApiError
    >('/api/tasks/:taskId', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authorization'),
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
  ];
};

// __________
// /api/tasks/:taskId/completion
export interface ApiTasksIdCompletion {
  params: {
    taskId: string;
  };
  put: {
    resBody: taskFeature.Task;
  };
  delete: {
    resBody: taskFeature.Task;
  };
}

const createTasksIdCompletionHandlers: RestHandlersCreator = (
  globalStorage
) => {
  return [
    rest.put<
      DefaultBodyType,
      ApiTasksIdCompletion['params'],
      ApiTasksIdCompletion['put']['resBody'] | AppApiError
    >('/api/tasks/:taskId/completion', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authorization'),
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

    rest.delete<
      DefaultBodyType,
      ApiTasksIdCompletion['params'],
      ApiTasksIdCompletion['delete']['resBody'] | AppApiError
    >('/api/tasks/:taskId/completion', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          state: globalStorage.globalState,
          input: {
            maybeBearerToken: req.headers.get('Authorization'),
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
};

// __________
// combine
export function createTaskRestHandlers(globalStorage: GlobalStorage) {
  return [
    ...createTasksHandlers(globalStorage),
    ...createTasksIdHandlers(globalStorage),
    ...createTasksIdCompletionHandlers(globalStorage),
  ];
}
