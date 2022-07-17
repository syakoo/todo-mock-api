import type { TaskState } from "../features/task";
import type { UserState } from "../features/user";
import type { UnknownRecord } from "../../utils/types";
export interface GlobalState {
    users: UserState[];
    tasks: TaskState[];
}
export declare const defaultGlobalState: GlobalState;
export declare function isValidGlobalState(state: UnknownRecord | null): boolean;
