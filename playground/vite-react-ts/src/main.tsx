import { startWorker, GlobalState } from '@syakoo/todo-mock-api';
import * as React from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

const initialState: GlobalState = {
  users: [
    {
      id: 'user1',
      username: 'username',
      password: 'password',
      token: 'token',
    },
  ],
  tasks: [
    {
      id: 'task1',
      userId: 'user1',
      title: 'Sample Task 1',
      detail: 'XXXXXXXXXXXXXXXX',
      is_complete: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 'task2',
      userId: 'user1',
      title: 'Sample Task 2',
      is_complete: false,
      created_at: new Date().toISOString(),
    },
  ],
};

startWorker({ initialState });

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
