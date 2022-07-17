import type { GlobalState } from './globalState/globalState';
import type { DeepReadonly } from "../utils/types";
export declare type WithDBStateInput<T> = {
    input: T;
    state: GlobalState;
};
export declare type WithDBStateReadonlyInput<T> = DeepReadonly<WithDBStateInput<T>>;
