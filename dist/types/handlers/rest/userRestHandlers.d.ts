import { DefaultBodyType } from 'msw';
import type { GlobalStorage } from "../../core/globalState/globalStorage";
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
export declare function createUserRestHandlers(globalStorage: GlobalStorage): import("msw").RestHandler<import("msw/lib/glossary-58eca5a8").M<DefaultBodyType>>[];
