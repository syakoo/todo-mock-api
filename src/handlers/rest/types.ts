import { RestHandler } from 'msw';

import { GlobalStorage } from '~/core/globalState/globalStorage';

export type RestHandlersCreator = (
  globalStorage: GlobalStorage
) => RestHandler[];
