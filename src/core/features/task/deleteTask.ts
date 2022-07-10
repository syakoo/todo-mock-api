import { deepCopyWithWriteable } from '~/utils/deepCopy';

import { TaskError } from './error';

import type { WithDBStateReadonlyInput } from '~/core/types';
import type { UserState } from '~/core/features/user';
import type { GlobalState } from '~/core/globalState';

interface DeleteTaskInput {
  user: UserState;
  id: string;
}

interface DeleteTaskReturn {
  state: GlobalState;
}

export async function deleteTask(
  props: WithDBStateReadonlyInput<DeleteTaskInput>
): Promise<DeleteTaskReturn> {
  const { state, input } = props;
  const newState = deepCopyWithWriteable(state);

  const taskState = newState.tasks.find(
    (t) => t.userId === input.user.id && t.id === input.id
  );

  if (!taskState) {
    throw new TaskError(`対象のタスクが見つかりませんでした`, 'TaskNotFound');
  }

  newState.tasks = newState.tasks.filter(
    (t) => !(t.userId === input.user.id && t.id === input.id)
  );

  return {
    state: newState,
  };
}
