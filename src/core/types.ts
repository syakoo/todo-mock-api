import { DeepReadonly } from '~/utils/types';

import { UserState } from './user/types';

export interface DBState {
  users: UserState[];
  tasks: [];
}

export type WithDBStateInput<T> = {
  input: T;
  state: DBState;
};

export type WithDBStateReadonlyInput<T> = DeepReadonly<WithDBStateInput<T>>;
