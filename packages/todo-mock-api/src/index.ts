import { setupWorker } from 'msw';

import { restHandlers } from './handlers/rest';

export const startWorker = () => {
  const worker = setupWorker(...restHandlers);

  worker.start();
};
