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
        resBody: taskFeature.Task;
    };
    delete: {
        resBody: {
            success: boolean;
        };
    };
}
export interface ApiTasksIdCompletion {
    params: {
        taskId: string;
    };
    put: {
        resBody: taskFeature.Task;
    };
    delete: {
        resBody: taskFeature.Task;
    };
}
export declare function createTaskRestHandlers(globalStorage: GlobalStorage): import("msw").RestHandler<import("msw/lib/glossary-58eca5a8").M<DefaultBodyType>>[];
