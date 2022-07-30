import { setupLocalStorage } from '~/store/localStorage';

import {
  type GlobalState,
  defaultGlobalState,
  isValidGlobalState,
} from './globalState';

import type { Store } from '~/store/types';
import type { UnknownRecord } from '~/utils/types';

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

export function createGlobalStorage(option?: GlobalStoreOption): GlobalStorage {
  const store = initStore(option);
  let globalState = store.getData() as unknown as GlobalState;

  const updateGlobalState = (state: GlobalState) => {
    store.setData(state);
    globalState = state;
  };

  return {
    get globalState() {
      return globalState;
    },
    updateGlobalState,
  };
}

function initStore(option?: GlobalStoreOption): Store<GlobalState> {
  if (option?.storeType === 'nothing') {
    return {
      getData: () => {
        return option?.initialState || defaultGlobalState;
      },
      setData: () => {
        // don't anything
      },
    };
  }

  // この時点では GlobalState は確定していない
  const store = setupLocalStorage<GlobalState>();

  try {
    if (option?.initialState) {
      store.setData(option.initialState);
    }
    if (!store.getData()) {
      store.setData(defaultGlobalState);
    }
  } catch (error) {
    throw new Error(
      '保存されているデータが正しい形式ではありません. データを削除するか、正しい形式に修正してください.'
    );
  }

  if (!isValidGlobalState(store.getData() as UnknownRecord | null)) {
    throw new Error(
      '保存されているデータが正しい形式ではありません. データを削除するか、正しい形式に修正してください.'
    );
  }

  return store;
}
