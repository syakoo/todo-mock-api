import type { Task } from './types';
import type { UserState } from "../user";
import type { WithDBStateReadonlyInput } from "../../types";
interface GetTaskInput {
    user: UserState;
    id: string;
}
interface GetTaskReturn {
    output: {
        task: Task;
    };
}
export declare function getTask(props: WithDBStateReadonlyInput<GetTaskInput>): Promise<GetTaskReturn>;
export {};
