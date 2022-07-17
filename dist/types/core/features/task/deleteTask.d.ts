import type { UserState } from "../user";
import type { GlobalState } from "../../globalState";
import type { WithDBStateReadonlyInput } from "../../types";
interface DeleteTaskInput {
    user: UserState;
    id: string;
}
interface DeleteTaskReturn {
    state: GlobalState;
}
export declare function deleteTask(props: WithDBStateReadonlyInput<DeleteTaskInput>): Promise<DeleteTaskReturn>;
export {};
