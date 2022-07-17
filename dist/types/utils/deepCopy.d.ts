import { DeepWriteable } from './types';
/**
 * オブジェクトをディープコピーして readonly を解除する
 */
export declare function deepCopyWithWriteable<T extends Record<string, unknown>>(object: T): DeepWriteable<T>;
