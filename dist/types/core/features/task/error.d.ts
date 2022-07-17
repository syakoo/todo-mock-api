import { CustomError } from "../../../utils/customError";
export declare type TaskErrorCode = 'InvalidTask' | 'TaskNotFound';
export declare class TaskError extends CustomError<TaskErrorCode> {
}
