import { type GlobalState } from './globalState';
export interface GlobalStoreOption {
    initialState?: GlobalState;
    storeType?: 'localStorage' | 'nothing';
}
export interface GlobalStorage {
    globalState: GlobalState;
    updateGlobalState: (state: GlobalState) => void;
}
export declare function createGlobalStorage(option?: GlobalStoreOption): GlobalStorage;
