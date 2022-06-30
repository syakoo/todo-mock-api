import { DeepWriteable } from './types';

/**
 * オブジェクトをディープコピーして readonly を解除する
 */
export function deepCopyWithWriteable<T extends Record<string, unknown>>(
  object: T
): DeepWriteable<T> {
  // Note: ディープコピーした結果はいじっても問題ないので readonly を消す
  // 消したくないのであれば structuredClone をそのまま使ってくれ
  return structuredClone(object) as unknown as DeepWriteable<T>;
}
