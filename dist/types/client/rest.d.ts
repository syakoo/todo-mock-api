import type { ApiHealth, ApiTasks, ApiUsersRegister, ApiUsersLogin, ApiUsersLogout, HTTPErrorResponseBody, ApiTasksId, ApiTasksIdCompletion } from "../handlers/rest";
export declare type ApiResponse<SuccessResponseBody> = Promise<{
    ok: false;
    body: HTTPErrorResponseBody;
} | {
    ok: true;
    body: SuccessResponseBody;
}>;
export declare const restApi: {
    health: {
        get: () => ApiResponse<ApiHealth['get']['resBody']>;
    };
    users: {
        register: {
            post: (payload: ApiUsersRegister['post']['reqBody']) => ApiResponse<ApiUsersRegister['post']['resBody']>;
        };
        login: {
            post: (payload: ApiUsersLogin['post']['reqBody']) => ApiResponse<ApiUsersLogin['post']['resBody']>;
        };
        logout: {
            post: (token: string) => ApiResponse<ApiUsersLogout['post']['resBody']>;
        };
    };
    tasks: {
        get: (token: string) => ApiResponse<ApiTasks['get']['resBody']>;
        post: (payload: ApiTasks['post']['reqBody'], token: string) => ApiResponse<ApiTasks['post']['resBody']>;
        _taskId: (taskId: string) => {
            get: (token: string) => ApiResponse<ApiTasksId['get']['resBody']>;
            patch: (payload: ApiTasksId['patch']['reqBody'], token: string) => ApiResponse<ApiTasksId['patch']['resBody']>;
            delete: (token: string) => ApiResponse<ApiTasksId['delete']['resBody']>;
            completion: {
                put: (token: string) => ApiResponse<ApiTasksIdCompletion['put']['resBody']>;
                delete: (token: string) => ApiResponse<ApiTasksIdCompletion['delete']['resBody']>;
            };
        };
    };
};
