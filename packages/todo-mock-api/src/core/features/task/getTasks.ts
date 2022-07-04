import { deepCopyWithWriteable } from '~/utils/deepCopy';

import type { WithDBStateReadonlyInput } from '~/core/types';
import type { UserState } from '~/core/features/user';
import type { Task } from './types';

interface GetTasksInput {
  user: UserState;
}

interface GetTasksReturn {
  output: {
    tasks: Task[];
  };
}

export async function getTasks(
  props: WithDBStateReadonlyInput<GetTasksInput>
): Promise<GetTasksReturn> {
  const { state, input } = props;
  const newState = deepCopyWithWriteable(state);

  const tasksState = newState.tasks.filter((t) => t.userId === input.user.user);

  const tasks: Task[] = tasksState.map((t) => {
    return {
      id: t.id,
      title: t.title,
      detail: t.detail,
      is_complete: t.is_complete,
      created_at: t.created_at,
    };
  });

  return {
    output: {
      tasks,
    },
  };
}
