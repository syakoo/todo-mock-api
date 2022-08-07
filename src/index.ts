export { startWorker, type WorkerOption } from './worker';
export { createServer, type ServerOption } from './server';
export * as client from './client';

export type { GlobalState } from './core/globalState';
export type {
  AppApiErrorCode,
  AppApiError,
  ApiHealth,
  ApiUsersLogin,
  ApiUsersLogout,
  ApiUsersRegister,
  ApiTasks,
  ApiTasksId,
  ApiTasksIdCompletion,
} from './handlers/rest';
export type { Task } from './core/features/task';
export type { User } from './core/features/user';
