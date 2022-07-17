import type { Task } from './types';
import type { UserState } from "../user";
import type { GlobalState } from "../../globalState";
import type { WithDBStateReadonlyInput } from "../../types";
declare type InputTask = Omit<Task, 'id' | 'created_at' | 'is_complete'>;
interface AddTaskInput {
    task: InputTask;
    user: UserState;
}
interface AddTaskReturn {
    state: GlobalState;
    output: {
        task: Task;
    };
}
export declare function addTask(props: WithDBStateReadonlyInput<AddTaskInput>): Promise<AddTaskReturn>;
export {};
