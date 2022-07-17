import { type DefaultBodyType } from 'msw';
import type { GlobalStorage } from "../../core/globalState/globalStorage";
export interface ApiHealth {
    get: {
        resBody: {
            message: string;
        };
    };
}
export declare function createRestHandlers(globalStorage: GlobalStorage): import("msw").RestHandler<import("msw/lib/glossary-58eca5a8").M<DefaultBodyType>>[];
