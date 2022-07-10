import { rest } from 'msw';

import { createGlobalStorage, GlobalState } from '~/core/globalState';

import { createUserRestHandlers } from './userRestHandlers';

interface HanlderOption {
  initialState?: GlobalState;
}

export function createRestHandlers(option?: HanlderOption) {
  const globalStorage = createGlobalStorage(option?.initialState);

  const restHandlers = [
    rest.get('/api/health', (req, res, ctx) => {
      return res(ctx.status(200), ctx.json({ message: "I'm healthy!" }));
    }),
    ...createUserRestHandlers(globalStorage),
  ];

  return restHandlers;
}
