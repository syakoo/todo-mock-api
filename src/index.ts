import { setupWorker } from 'msw';

import { createRestHandlers } from './handlers/rest';

import type { GlobalState } from './core/globalState';
import type {
  AppErrorCode,
  HTTPErrorResponseBody,
} from './handlers/rest/error';

interface WorkerOption {
  type?: 'rest';
  initialState?: GlobalState;
}

export const startWorker = (option?: WorkerOption) => {
  const worker = setupWorker(
    ...createRestHandlers({ initialState: option?.initialState })
  );

  worker.start();
};

export type { GlobalState, AppErrorCode, HTTPErrorResponseBody };
