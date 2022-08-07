import { GlobalStoreOption } from './core/globalState/globalStorage';
export declare type ServerOption = Omit<GlobalStoreOption, 'storeType'>;
export declare const createServer: (option?: ServerOption) => import("msw/lib/glossary-58eca5a8").z;
