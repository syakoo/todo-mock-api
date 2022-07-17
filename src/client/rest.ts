import type {
  ApiHealth,
  ApiTasks,
  ApiUsersRegister,
  ApiUsersLogin,
  ApiUsersLogout,
  HTTPErrorResponseBody,
  ApiTasksId,
  ApiTasksIdCompletion,
} from '~/handlers/rest';

export type ApiResponse<SuccessResponseBody> = Promise<
  | {
      ok: false;
      body: HTTPErrorResponseBody;
    }
  | {
      ok: true;
      body: SuccessResponseBody;
    }
>;

export const restApi = {
  health: {
    get: async (): ApiResponse<ApiHealth['get']['resBody']> => {
      const res = await fetch('/api/health');
      const body = await res.json();

      return {
        ok: res.ok,
        body,
      };
    },
  },

  users: {
    register: {
      post: async (
        payload: ApiUsersRegister['post']['reqBody']
      ): ApiResponse<ApiUsersRegister['post']['resBody']> => {
        const res = await fetch('/api/users/register', {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const body = await res.json();

        return {
          ok: res.ok,
          body,
        };
      },
    },
    login: {
      post: async (
        payload: ApiUsersLogin['post']['reqBody']
      ): ApiResponse<ApiUsersLogin['post']['resBody']> => {
        const res = await fetch('/api/users/login', {
          method: 'post',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        const body = await res.json();

        return {
          ok: res.ok,
          body,
        };
      },
    },
    logout: {
      post: async (
        token: string
      ): ApiResponse<ApiUsersLogout['post']['resBody']> => {
        const res = await fetch('/api/users/logout', {
          method: 'post',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const body = await res.json();

        return {
          ok: res.ok,
          body,
        };
      },
    },
  },

  tasks: {
    get: async (token: string): ApiResponse<ApiTasks['get']['resBody']> => {
      const res = await fetch('/api/tasks', {
        method: 'get',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const body = await res.json();

      return {
        ok: res.ok,
        body,
      };
    },
    post: async (
      payload: ApiTasks['post']['reqBody'],
      token: string
    ): ApiResponse<ApiTasks['post']['resBody']> => {
      const res = await fetch('/api/tasks', {
        method: 'post',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = await res.json();

      return {
        ok: res.ok,
        body,
      };
    },
    _taskId: (taskId: string) => {
      return {
        get: async (
          token: string
        ): ApiResponse<ApiTasksId['get']['resBody']> => {
          const res = await fetch(`/api/tasks/${taskId}`, {
            method: 'get',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const body = await res.json();

          return {
            ok: res.ok,
            body,
          };
        },
        patch: async (
          payload: ApiTasksId['patch']['reqBody'],
          token: string
        ): ApiResponse<ApiTasksId['patch']['resBody']> => {
          const res = await fetch(`/api/tasks/${taskId}`, {
            method: 'patch',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          const body = await res.json();

          return {
            ok: res.ok,
            body,
          };
        },
        delete: async (
          token: string
        ): ApiResponse<ApiTasksId['delete']['resBody']> => {
          const res = await fetch(`/api/tasks/${taskId}`, {
            method: 'delete',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const body = await res.json();

          return {
            ok: res.ok,
            body,
          };
        },

        completion: {
          put: async (
            token: string
          ): ApiResponse<ApiTasksIdCompletion['put']['resBody']> => {
            const res = await fetch(`/api/tasks/${taskId}/completion`, {
              method: 'put',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            const body = await res.json();

            return {
              ok: res.ok,
              body,
            };
          },
          delete: async (
            token: string
          ): ApiResponse<ApiTasksIdCompletion['delete']['resBody']> => {
            const res = await fetch(`/api/tasks/${taskId}/completion`, {
              method: 'delete',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            const body = await res.json();

            return {
              ok: res.ok,
              body,
            };
          },
        },
      };
    },
  },
};
