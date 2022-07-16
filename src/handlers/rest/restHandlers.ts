import { rest, type DefaultBodyType, type PathParams } from 'msw';

import { createTaskRestHandlers } from './taskRestHandlers';
import { createUserRestHandlers } from './userRestHandlers';

import type { GlobalStorage } from '~/core/globalState/globalStorage';

export interface ApiHealth {
  get: {
    resBody: {
      message: string;
    };
  };
}

export function createRestHandlers(globalStorage: GlobalStorage) {
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
