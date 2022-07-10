import { deepCopyWithWriteable } from '~/utils/deepCopy';

import { TaskError } from './error';

import type { WithDBStateReadonlyInput } from '~/core/types';
import type { UserState } from '~/core/features/user';
import type { Task } from './types';
import type { GlobalState } from '~/core/globalState';

const changeableTaskParamKey = ['title', 'detail'] as const;
type ChangeableTaskParamKey = typeof changeableTaskParamKey[number];
// NOTE: 変更するときは validator もチェックしてね
export type IncomingPartialTask = Partial<Pick<Task, ChangeableTaskParamKey>>;

interface UpdateTaskInput {
  user: UserState;
  id: string;
  incomingPartialTask: IncomingPartialTask;
}

interface UpdateTaskReturn {
  state: GlobalState;
  output: {
    task: Task;
  };
}

export async function updateTask(
  props: WithDBStateReadonlyInput<UpdateTaskInput>
): Promise<UpdateTaskReturn> {
  const { state, input } = props;
  const newState = deepCopyWithWriteable(state);

  const taskState = newState.tasks.find(
    (t) => t.userId === input.user.id && t.id === input.id
  );
  if (!taskState) {
    throw new TaskError(`対象のタスクが見つかりませんでした`, 'TaskNotFound');
  }

  for (const k of changeableTaskParamKey) {
    const v = input.incomingPartialTask[k];
    // NOTE: detail は undefined 可なので弾いていいのか...
    if (v !== undefined) {
      taskState[k] = v;
    }
  }
  const task: Task = {
    id: taskState.id,
    title: taskState.title,
    detail: taskState.detail,
    is_complete: taskState.is_complete,
    created_at: taskState.created_at,
  };

  return {
    state: newState,
    output: {
      task,
    },
  };
}
