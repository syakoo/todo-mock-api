import type { Task } from './types';
import type { UserState } from "../user";
import type { WithDBStateReadonlyInput } from "../../types";
interface GetTasksInput {
    user: UserState;
}
interface GetTasksReturn {
    output: {
        tasks: Task[];
    };
}
export declare function getTasks(props: WithDBStateReadonlyInput<GetTasksInput>): Promise<GetTasksReturn>;
export {};
