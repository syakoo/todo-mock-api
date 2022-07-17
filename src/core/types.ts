import type { GlobalState } from './globalState/globalState';
import type { DeepReadonly } from '~/utils/types';

export type WithDBStateInput<T> = {
  input: T;
  state: GlobalState;
};

export type WithDBStateReadonlyInput<T> = DeepReadonly<WithDBStateInput<T>>;
