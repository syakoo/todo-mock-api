import { deepCopyWithWriteable } from '~/utils/deepCopy';

import { TaskError } from './error';

import type { WithDBStateReadonlyInput } from '~/core/types';
import type { UserState } from '~/core/features/user';
import type { Task } from './types';

interface GetTaskInput {
  user: UserState;
  id: string;
}

interface GetTaskReturn {
  output: {
    task: Task;
  };
}

export async function getTask(
  props: WithDBStateReadonlyInput<GetTaskInput>
): Promise<GetTaskReturn> {
  const { state, input } = props;
  const newState = deepCopyWithWriteable(state);

  const taskState = newState.tasks.find(
    (t) => t.userId === input.user.id && t.id === input.id
  );

  if (!taskState) {
    throw new TaskError(`対象のタスクが見つかりませんでした`, 'TaskNotFound');
  }

  const task: Task = {
    id: taskState.id,
    title: taskState.title,
    detail: taskState.detail,
    is_complete: taskState.is_complete,
    created_at: taskState.created_at,
  };

  return {
    output: {
      task,
    },
  };
}
