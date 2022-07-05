import { isUnknownRecord } from '~/utils/validator';
import { ValidateError } from '~/utils/customError';

import type { Task, TaskState } from './types';
import type { UnknownRecord } from '~/utils/types';

export function assertValidTaskId(
  maybeTaskId: unknown
): asserts maybeTaskId is string {
  if (typeof maybeTaskId !== 'string') {
    throw new ValidateError(
      'タスク ID が文字列ではありません',
      'タスクの値が無効です'
    );
  }
}

export function assertValidTaskTitle(
  maybeTaskTitle: unknown
): asserts maybeTaskTitle is string {
  if (typeof maybeTaskTitle !== 'string') {
    throw new ValidateError(
      'タスクタイトルが文字列ではありません',
      'タスクの値が無効です'
    );
  }
}

export function assertValidTaskDetail(
  maybeTaskDetail: unknown
): asserts maybeTaskDetail is string | undefined {
  if (maybeTaskDetail === undefined) return;

  if (typeof maybeTaskDetail !== 'string') {
    throw new ValidateError(
      'タスク詳細が文字列ではありません',
      'タスクの値が無効です'
    );
  }
}

export function assertValidTaskIsComplete(
  maybeTaskIsComplete: unknown
): asserts maybeTaskIsComplete is boolean {
  if (typeof maybeTaskIsComplete !== 'boolean') {
    throw new ValidateError(
      'タスク完了フラグが真偽値ではありません',
      'タスクの値が無効です'
    );
  }
}

export function assertValidTaskCreatedAt(
  maybeTaskIsCreatedAt: unknown
): asserts maybeTaskIsCreatedAt is string {
  if (typeof maybeTaskIsCreatedAt !== 'string') {
    throw new ValidateError(
      'タスク作成日時が文字列ではありません',
      'タスクの値が無効です'
    );
  }

  if (isNaN(Date.parse(maybeTaskIsCreatedAt))) {
    throw new ValidateError(
      'タスク作成日時が日付のフォーマットではありません',
      'タスクの値が無効です'
    );
  }
}

export function assertValidTaskUserId(
  maybeTaskIsUserId: unknown
): asserts maybeTaskIsUserId is string {
  if (typeof maybeTaskIsUserId !== 'string') {
    throw new ValidateError(
      'タスクのユーザー ID が文字列ではありません',
      'タスクの値が無効です'
    );
  }
}

export function assertValidTask(
  maybeTaskState: unknown
): asserts maybeTaskState is Task {
  if (!isUnknownRecord(maybeTaskState)) {
    throw new ValidateError(
      'タスクがオブジェクト型ではありません',
      'タスクの値が正しくありません'
    );
  }

  assertValidTaskId(maybeTaskState.id);
  assertValidTaskTitle(maybeTaskState.title);
  if ('detail' in maybeTaskState) {
    assertValidTaskDetail(maybeTaskState.detail);
  }
  assertValidTaskIsComplete(maybeTaskState.is_complete);
}

export function assertValidTaskState(
  maybeTaskState: unknown
): asserts maybeTaskState is TaskState {
  assertValidTask(maybeTaskState);
  assertValidTaskUserId((maybeTaskState as unknown as UnknownRecord).userId);
}
