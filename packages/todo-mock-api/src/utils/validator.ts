import { UnknownRecord } from './types';

export function isUnknownRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object';
}
