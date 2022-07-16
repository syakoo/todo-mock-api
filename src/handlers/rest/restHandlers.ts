import { rest, type DefaultBodyType, type PathParams } from 'msw';

import { createGlobalStorage, GlobalState } from '~/core/globalState';

import { createTaskRestHandlers } from './taskRestHandlers';
import { createUserRestHandlers } from './userRestHandlers';

interface HandlerOption {
  initialState?: GlobalState;
}

export interface ApiHealth {
  get: {
    resBody: {
      message: string;
    };
  };
}

export function createRestHandlers(option?: HandlerOption) {
  const globalStorage = createGlobalStorage(option?.initialState);

  const restHandlers = [
    rest.get<DefaultBodyType, PathParams, ApiHealth['get']['resBody']>(
      '/api/health',
      (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({ message: "I'm healthy!" }));
      }
    ),
    ...createUserRestHandlers(globalStorage),
    ...createTaskRestHandlers(globalStorage),
  ];

  return restHandlers;
}
