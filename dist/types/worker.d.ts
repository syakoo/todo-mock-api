import type { GlobalStoreOption } from './core/globalState/globalStorage';
export interface WorkerOption extends GlobalStoreOption {
    type?: 'rest';
}
export declare const startWorker: (option?: WorkerOption) => void;
