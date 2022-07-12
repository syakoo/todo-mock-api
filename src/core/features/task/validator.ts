import { isUnknownRecord } from '~/utils/validator';

import { TaskError } from './error';

import type { Task, TaskState } from './types';
import type { IncomingPartialTask } from './updateTask';
import type { UnknownRecord } from '~/utils/types';

export function assertValidTaskId(
  maybeTaskId: unknown
): asserts maybeTaskId is string {
  if (typeof maybeTaskId !== 'string') {
    throw new TaskError('タスク ID が文字列ではありません', 'InvalidTask');
  }
}

export function assertValidTaskTitle(
  maybeTaskTitle: unknown
): asserts maybeTaskTitle is string {
  if (typeof maybeTaskTitle !== 'string') {
    throw new TaskError('タスクタイトルが文字列ではありません', 'InvalidTask');
  }
}

export function assertValidTaskDetail(
  maybeTaskDetail: unknown
): asserts maybeTaskDetail is string | undefined {
  if (maybeTaskDetail === undefined) return;

  if (typeof maybeTaskDetail !== 'string') {
    throw new TaskError('タスク詳細が文字列ではありません', 'InvalidTask');
  }
}

export function assertValidTaskIsComplete(
  maybeTaskIsComplete: unknown
): asserts maybeTaskIsComplete is boolean {
  if (typeof maybeTaskIsComplete !== 'boolean') {
    throw new TaskError(
      'タスク完了フラグが真偽値ではありません',
      'InvalidTask'
    );
  }
}

export function assertValidTaskCreatedAt(
  maybeTaskIsCreatedAt: unknown
): asserts maybeTaskIsCreatedAt is string {
  if (typeof maybeTaskIsCreatedAt !== 'string') {
    throw new TaskError('タスク作成日時が文字列ではありません', 'InvalidTask');
  }

  if (isNaN(Date.parse(maybeTaskIsCreatedAt))) {
    throw new TaskError(
      'タスク作成日時が日付のフォーマットではありません',
      'InvalidTask'
    );
  }
}

export function assertValidTaskUserId(
  maybeTaskIsUserId: unknown
): asserts maybeTaskIsUserId is string {
  if (typeof maybeTaskIsUserId !== 'string') {
    throw new TaskError(
      'タスクのユーザー ID が文字列ではありません',
      'InvalidTask'
    );
  }
}

export function assertValidTask(
  maybeTaskState: unknown
): asserts maybeTaskState is Task {
  if (!isUnknownRecord(maybeTaskState)) {
    throw new TaskError('タスクがオブジェクト型ではありません', 'InvalidTask');
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

export function assertValidIncomingPartialTask(
  maybeIncomingPartialTask: unknown
): asserts maybeIncomingPartialTask is IncomingPartialTask {
  if (!isUnknownRecord(maybeIncomingPartialTask)) {
    throw new TaskError('タスクがオブジェクト型ではありません', 'InvalidTask');
  }

  if ('title' in maybeIncomingPartialTask) {
    assertValidTaskTitle(maybeIncomingPartialTask.title);
  }
  if ('detail' in maybeIncomingPartialTask) {
    assertValidTaskDetail(maybeIncomingPartialTask.detail);
  }
}
