import { setupWorker } from 'msw';

import { createGlobalStorage, type GlobalState } from './core/globalState';
import { createRestHandlers } from './handlers/rest';

export interface WorkerOption {
  type?: 'rest';
  initialState?: GlobalState;
}

export const startWorker = (option?: WorkerOption) => {
  const globalStorage = createGlobalStorage(option?.initialState);

  const worker = setupWorker(...createRestHandlers(globalStorage));

  worker.start();
};
