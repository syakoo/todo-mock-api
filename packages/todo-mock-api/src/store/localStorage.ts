import { Store } from './types';

export function setupLocalStorage<T extends object>(): Store<T> {
  const LOCAL_STORAGE_KEY = 'TODO_MOCK_API_STORAGE_KEY';

  const store: Store<T> = {
    getData: () => {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data && JSON.parse(data);
    },

    setData: (state) => {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    },
  };

  return store;
}
