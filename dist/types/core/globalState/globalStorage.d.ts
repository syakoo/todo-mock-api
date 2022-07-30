import { type GlobalState } from './globalState';
export interface GlobalStoreOption {
    /**
     * データの初期値。
     */
    initialState?: GlobalState;
    /**
     * データを保持する方法。
     * なにも選択しなかった場合は 'localStorage' になる。
     */
    storeType?: 'localStorage' | 'nothing';
}
export interface GlobalStorage {
    globalState: GlobalState;
    updateGlobalState: (state: GlobalState) => void;
}
export declare function createGlobalStorage(option?: GlobalStoreOption): GlobalStorage;
