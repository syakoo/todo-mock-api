import { setupServer } from 'msw/node';

import {
  createGlobalStorage,
  GlobalStoreOption,
} from './core/globalState/globalStorage';
import { createRestHandlers } from './handlers/rest';

export type ServerOption = Omit<GlobalStoreOption, 'storeType'>;

export const createServer = (option?: ServerOption) => {
  const globalStorage = createGlobalStorage({
    ...option,
    storeType: 'nothing',
  });

  return setupServer(...createRestHandlers(globalStorage));
};
