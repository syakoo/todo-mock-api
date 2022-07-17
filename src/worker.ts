import { setupWorker } from 'msw';

import { createGlobalStorage } from './core/globalState';
import { createRestHandlers } from './handlers/rest';

import type { GlobalStoreOption } from './core/globalState/globalStorage';

export interface WorkerOption extends GlobalStoreOption {
  type?: 'rest';
}

export const startWorker = (option?: WorkerOption) => {
  const globalStorage = createGlobalStorage(option);

  const worker = setupWorker(...createRestHandlers(globalStorage));

  worker.start();
};
