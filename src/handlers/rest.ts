import { rest } from 'msw';

export const restHandlers = [
  rest.get('/api/user', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json('Hello World'));
  }),
];
