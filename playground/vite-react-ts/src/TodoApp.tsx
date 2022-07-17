import { useEffect } from 'react';

import { useTask } from './useTask';

type TodoAppProps = {
  token: string;
};

export function TodoApp(props: TodoAppProps) {
  const { token } = props;
  const { tasks, fetchTasks, completeTask, removeCompleteTask } =
    useTask(token);

  const onClickTaskCheckbox = (
    e: React.ChangeEvent<HTMLInputElement>,
    taskId: string
  ) => {
    e.target.checked ? completeTask(taskId) : removeCompleteTask(taskId);
  };

  useEffect(() => {
    fetchTasks();
  }, [token]);

  return (
    <div>
      <h1>Tasks</h1>
      {!tasks && <div>Now Loading...</div>}
      {tasks && (
        <ul className="tasks">
          {tasks.map((t) => (
            <li key={t.id} className="task">
              <input
                type="checkbox"
                onChange={(e) => onClickTaskCheckbox(e, t.id)}
                checked={t.is_complete}
              />
              <div>
                <h2 className="task__title">{t.title}</h2>
                <div className="task__detail">{t.detail}</div>
                <div className="task__created-at">{t.created_at}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
