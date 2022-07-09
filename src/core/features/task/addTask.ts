import { deepCopyWithWriteable } from '~/utils/deepCopy';
import { sha256 } from '~/utils/sha256';

import type { GlobalState } from '~/core/globalState';
import type { WithDBStateReadonlyInput } from '~/core/types';
import type { UserState } from '~/core/features/user';
import type { Task } from './types';

type InputTask = Omit<Task, 'id' | 'created_at' | 'is_complete'>;

interface AddTaskInput {
  task: InputTask;
  user: UserState;
}

interface AddTaskReturn {
  state: GlobalState;
  output: {
    task: Task;
  };
}

export async function addTask(
  props: WithDBStateReadonlyInput<AddTaskInput>
): Promise<AddTaskReturn> {
  const { state, input } = props;
  const newState = deepCopyWithWriteable(state);

  const createdAt = new Date().toISOString();
  const id = await sha256(`${input.user}:${createdAt}`);
  const task: Task = {
    ...input.task,
    id,
    is_complete: false,
    created_at: createdAt,
  };

  newState.tasks.push({
    ...task,
    userId: input.user.id,
  });

  return {
    state: newState,
    output: {
      task: task,
    },
  };
}
