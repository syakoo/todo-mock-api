import { setupLocalStorage } from '~/store/localStorage';

import {
  type GlobalState,
  defaultGlobalState,
  isValidGlobalState,
} from './globalState';

import type { Store } from '~/store/types';
import type { UnknownRecord } from '~/utils/types';

export interface GlobalStorage {
  globalState: GlobalState;
  updateGlobalState: (state: GlobalState) => void;
}

export function createGlobalStorage(): GlobalStorage {
  const store = initStore();
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

function initStore(): Store<GlobalState> {
  // この時点では GlobalState は確定していない
  const store = setupLocalStorage<GlobalState>();

  try {
    if (!store.getData()) {
      store.setData(defaultGlobalState);
    }
  } catch {
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
