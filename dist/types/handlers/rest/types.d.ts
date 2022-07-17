import { RestHandler } from 'msw';
import { GlobalStorage } from "../../core/globalState/globalStorage";
export declare type RestHandlersCreator = (globalStorage: GlobalStorage) => RestHandler[];
