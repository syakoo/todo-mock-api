import { deepCopyWithWriteable } from '~/utils/deepCopy';

import { TaskError } from './error';

import type { WithDBStateReadonlyInput } from '~/core/types';
import type { UserState } from '~/core/features/user';
import type { Task } from './types';
import type { GlobalState } from '~/core/globalState';

interface UpdateTaskCompletionInput {
  user: UserState;
  id: string;
  isComplete: boolean;
}

interface UpdateTaskCompletionReturn {
  state: GlobalState;
  output: {
    task: Task;
  };
}

export async function updateTaskCompletion(
  props: WithDBStateReadonlyInput<UpdateTaskCompletionInput>
): Promise<UpdateTaskCompletionReturn> {
  const { state, input } = props;
  const newState = deepCopyWithWriteable(state);

  const taskState = newState.tasks.find(
    (t) => t.userId === input.user.id && t.id === input.id
  );

  if (!taskState) {
    throw new TaskError(`対象のタスクが見つかりませんでした`, 'TaskNotFound');
  }

  taskState.is_complete = input.isComplete;
  const task: Task = {
    id: taskState.id,
    title: taskState.title,
    detail: taskState.detail,
    is_complete: input.isComplete,
    created_at: taskState.created_at,
  };

  return {
    state: newState,
    output: {
      task,
    },
  };
}
