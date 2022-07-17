import type { Task } from './types';
import type { UserState } from "../user";
import type { GlobalState } from "../../globalState";
import type { WithDBStateReadonlyInput } from "../../types";
declare const changeableTaskParamKey: readonly ["title", "detail"];
declare type ChangeableTaskParamKey = typeof changeableTaskParamKey[number];
export declare type IncomingPartialTask = Partial<Pick<Task, ChangeableTaskParamKey>>;
interface UpdateTaskInput {
    user: UserState;
    id: string;
    incomingPartialTask: IncomingPartialTask;
}
interface UpdateTaskReturn {
    state: GlobalState;
    output: {
        task: Task;
    };
}
export declare function updateTask(props: WithDBStateReadonlyInput<UpdateTaskInput>): Promise<UpdateTaskReturn>;
export {};
