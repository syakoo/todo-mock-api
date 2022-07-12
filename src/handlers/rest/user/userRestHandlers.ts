import { rest } from 'msw';

import * as tokenFeature from '~/core/features/token';
import * as userFeature from '~/core/features/user';

import { error2HttpErrorResponse } from '../error';

import type { GlobalStorage } from '~/core/globalState/globalStorage';
import type { UnknownRecord } from '~/utils/types';

export function createUserRestHandlers(globalStorage: GlobalStorage) {
  const userRestHandlers = [
    rest.post<UnknownRecord>('/api/users/register', async (req, res, ctx) => {
      try {
        userFeature.assertValidUserName(req.body.username);
        userFeature.assertValidPassword(req.body.password);
        const userInfo = {
          username: req.body.username,
          password: req.body.password,
        };

        const result = await userFeature.registerUser({
          input: userInfo,
          state: globalStorage.globalState,
        });
        globalStorage.updateGlobalState(result);

        return res(
          ctx.status(200),
          ctx.json({
            success: true,
          })
        );
      } catch (error) {
        const response = error2HttpErrorResponse(error);
        return res(ctx.status(response.status), ctx.json(response.body));
      }
    }),

    rest.post<UnknownRecord>('/api/users/login', async (req, res, ctx) => {
      try {
        userFeature.assertValidUserName(req.body.username);
        userFeature.assertValidPassword(req.body.password);
        const userInfo = {
          username: req.body.username,
          password: req.body.password,
        };

        const result = await userFeature.loginUser({
          input: userInfo,
          state: globalStorage.globalState,
        });
        globalStorage.updateGlobalState(result.state);

        return res(
          ctx.status(200),
          ctx.json({
            success: true,
            token: result.outputs.token,
          })
        );
      } catch (error) {
        const response = error2HttpErrorResponse(error);
        return res(ctx.status(response.status), ctx.json(response.body));
      }
    }),

    rest.post('/api/users/logout', async (req, res, ctx) => {
      try {
        const user = await tokenFeature.getUserFromToken({
          input: { maybeBearerToken: req.headers.get('Authorization') },
          state: globalStorage.globalState,
        });

        const result = await userFeature.logoutUser({
          input: { user },
          state: globalStorage.globalState,
        });
        globalStorage.updateGlobalState(result);

        return res(
          ctx.status(200),
          ctx.json({
            success: true,
          })
        );
      } catch (error) {
        const response = error2HttpErrorResponse(error);
        return res(ctx.status(response.status), ctx.json(response.body));
      }
    }),
  ];

  return userRestHandlers;
}
