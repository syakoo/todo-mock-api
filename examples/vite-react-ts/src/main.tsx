import React from 'react';
import ReactDOM from 'react-dom/client';
import { worker } from 'todo-browser-mock-api';

import App from './App';
import './index.css';

worker.start();

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
