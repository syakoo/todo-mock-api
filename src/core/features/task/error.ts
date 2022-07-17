import { CustomError } from '~/utils/customError';

export type TaskErrorCode = 'InvalidTask' | 'TaskNotFound';

export class TaskError extends CustomError<TaskErrorCode> {}
