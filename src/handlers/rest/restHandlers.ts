import { rest } from 'msw';

import { createGlobalStorage } from '~/core/globalState';

import { createUserRestHandlers } from './userRestHandlers';

export function createRestHandlers() {
  const globalStorage = createGlobalStorage();

  const restHandlers = [
    rest.get('/api/health', (req, res, ctx) => {
      return res(ctx.status(200), ctx.json({ message: "I'm healthy!" }));
    }),
    ...createUserRestHandlers(globalStorage),
  ];

  return restHandlers;
}
