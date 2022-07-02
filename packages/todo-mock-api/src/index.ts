import { setupWorker } from 'msw';

import { createRestHandlers } from './handlers/rest';

export const startWorker = () => {
  const worker = setupWorker(...createRestHandlers());

  worker.start();
};
