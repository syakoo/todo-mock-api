import { type PathParams, rest, DefaultBodyType } from 'msw';

import * as tokenFeature from '~/core/features/token';
import * as userFeature from '~/core/features/user';

import { error2HttpErrorResponse, AppApiError } from './error';

import type { RestHandlersCreator } from './types';
import type { GlobalStorage } from '~/core/globalState/globalStorage';

// __________
// /api/users/register
export interface ApiUsersRegister {
  post: {
    reqBody: {
      username: string;
      password: string;
    };
    resBody: {
      success: boolean;
    };
  };
}

const createUsersRegisterHandlers: RestHandlersCreator = (globalStorage) => {
  return [
    rest.post<
      ApiUsersRegister['post']['reqBody'],
      PathParams,
      ApiUsersRegister['post']['resBody'] | AppApiError
    >('/api/users/register', async (req, res, ctx) => {
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
  ];
};

// __________
// /api/users/login
export interface ApiUsersLogin {
  post: {
    reqBody: {
      username: string;
      password: string;
    };
    resBody: {
      success: true;
      token: string;
    };
  };
}

const createUsersLoginHandlers: RestHandlersCreator = (globalStorage) => {
  return [
    rest.post<
      ApiUsersLogin['post']['reqBody'],
      PathParams,
      ApiUsersLogin['post']['resBody'] | AppApiError
    >('/api/users/login', async (req, res, ctx) => {
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
  ];
};

// __________
// /api/users/logout
export interface ApiUsersLogout {
  post: {
    reqHeaders: {
      Authorization: string;
    };
    resBody: {
      success: boolean;
    };
  };
}

const createUsersLogoutHandlers: RestHandlersCreator = (globalStorage) => {
  return [
    rest.post<
      DefaultBodyType,
      PathParams,
      ApiUsersLogout['post']['resBody'] | AppApiError
    >('/api/users/logout', async (req, res, ctx) => {
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
};

// __________
// combine
export function createUserRestHandlers(globalStorage: GlobalStorage) {
  return [
    ...createUsersRegisterHandlers(globalStorage),
    ...createUsersLoginHandlers(globalStorage),
    ...createUsersLogoutHandlers(globalStorage),
  ];
}
