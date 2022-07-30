import { type DefaultBodyType } from 'msw';
import * as taskFeature from "../../core/features/task";
import type { GlobalStorage } from "../../core/globalState/globalStorage";
export interface ApiTasks {
    get: {
        resBody: taskFeature.Task[];
    };
    post: {
        reqBody: {
            title: string;
            detail?: string;
        };
        resBody: taskFeature.Task;
    };
}
export interface ApiTasksId {
    params: {
        taskId: string;
    };
    get: {
        resBody: taskFeature.Task;
    };
    patch: {
        reqBody: {
            title?: string;
            detail?: string;
        };
        resBody: null;
    };
    delete: {
        resBody: null;
    };
}
export interface ApiTasksIdCompletion {
    params: {
        taskId: string;
    };
    put: {
        resBody: null;
    };
    delete: {
        resBody: null;
    };
}
export declare function createTaskRestHandlers(globalStorage: GlobalStorage): import("msw").RestHandler<import("msw/lib/glossary-58eca5a8").M<DefaultBodyType>>[];
