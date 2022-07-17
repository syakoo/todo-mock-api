import { Task, client } from '@syakoo/todo-mock-api';
import { useState, useCallback } from 'react';

export function useTask(token: string) {
  const [tasks, setTasks] = useState<undefined | Task[]>(undefined);

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    const res = await client.restApi.tasks.get(token);

    if (res.ok) {
      setTasks(res.body);
    }
    return res.body;
  }, []);

  const addTask = useCallback(
    async ({ title, detail }: { title: string; detail?: string }) => {
      if (!token) return;
      const res = await client.restApi.tasks.post(
        {
          title,
          detail,
        },
        token
      );

      if (res.ok) {
        setTasks((tasks) => {
          if (tasks) {
            return [...tasks, res.body];
          }
          return [res.body];
        });
      }
    },
    []
  );

  const fetchTask = useCallback(async (taskId: string) => {
    if (!token) return;
    const res = await client.restApi.tasks._taskId(taskId).get(token);

    return res.body;
  }, []);

  const updateTask = useCallback(
    async (taskId: string, payload: { title?: string; detail?: string }) => {
      if (!token) return;
      const res = await client.restApi.tasks
        ._taskId(taskId)
        .patch(payload, token);

      if (res.ok) {
        setTasks((tasks) =>
          tasks?.map((t) => (t.id === taskId ? { ...t, ...payload } : t))
        );
      }
    },
    []
  );

  const deleteTask = useCallback(async (taskId: string) => {
    if (!token) return;
    const res = await client.restApi.tasks._taskId(taskId).delete(token);

    if (res.ok) {
      setTasks((tasks) => tasks?.filter((t) => t.id !== taskId));
    }
  }, []);

  const completeTask = useCallback(async (taskId: string) => {
    if (!token) return;
    const res = await client.restApi.tasks
      ._taskId(taskId)
      .completion.put(token);

    if (res.ok) {
      setTasks((tasks) =>
        tasks?.map((t) => (t.id === taskId ? { ...t, is_complete: true } : t))
      );
    }
  }, []);

  const removeCompleteTask = useCallback(async (taskId: string) => {
    if (!token) return;
    const res = await client.restApi.tasks
      ._taskId(taskId)
      .completion.delete(token);

    if (res.ok) {
      setTasks((tasks) =>
        tasks?.map((t) => (t.id === taskId ? { ...t, is_complete: false } : t))
      );
    }
  }, []);

  return {
    tasks,
    fetchTasks,
    addTask,
    fetchTask,
    updateTask,
    deleteTask,
    completeTask,
    removeCompleteTask,
  };
}
