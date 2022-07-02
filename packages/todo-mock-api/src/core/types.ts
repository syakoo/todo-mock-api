import type { DeepReadonly } from '~/utils/types';
import type { GlobalState } from './globalState/globalState';

export type WithDBStateInput<T> = {
  input: T;
  state: GlobalState;
};

export type WithDBStateReadonlyInput<T> = DeepReadonly<WithDBStateInput<T>>;
