import { setupWorker } from 'msw';

import { createRestHandlers } from './handlers/rest';

import type { GlobalState } from './core/globalState';

export interface WorkerOption {
  type?: 'rest';
  initialState?: GlobalState;
}

export const startWorker = (option?: WorkerOption) => {
  const worker = setupWorker(
    ...createRestHandlers({ initialState: option?.initialState })
  );

  worker.start();
};
