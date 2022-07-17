import type { Task } from './types';
import type { UserState } from "../user";
import type { GlobalState } from "../../globalState";
import type { WithDBStateReadonlyInput } from "../../types";
interface UpdateTaskCompletionInput {
    user: UserState;
    id: string;
    isComplete: boolean;
}
interface UpdateTaskCompletionReturn {
    state: GlobalState;
    output: {
        task: Task;
    };
}
export declare function updateTaskCompletion(props: WithDBStateReadonlyInput<UpdateTaskCompletionInput>): Promise<UpdateTaskCompletionReturn>;
export {};
