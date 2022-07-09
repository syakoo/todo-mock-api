import { rest } from 'msw';

import { createGlobalStorage } from '~/core/globalState';

import { createUserRestHandlers } from './userRestHandlers';

export function createRestHandlers() {
  const globalStorage = createGlobalStorage();

  const restHandlers = [
    rest.get('/api/hello_world', (req, res, ctx) => {
      return res(ctx.status(200), ctx.json('Hello World'));
    }),
    ...createUserRestHandlers(globalStorage),
  ];

  return restHandlers;
}
