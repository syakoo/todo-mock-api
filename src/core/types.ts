import { DeepReadonly } from '~/utils/types';

import { UserState } from './user/types';

export interface GlobalState {
  users: UserState[];
  tasks: [];
}

export type WithDBStateInput<T> = {
  input: T;
  state: GlobalState;
};

export type WithDBStateReadonlyInput<T> = DeepReadonly<WithDBStateInput<T>>;
