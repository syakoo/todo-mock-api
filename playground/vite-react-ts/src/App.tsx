import { useState } from 'react';

import logo from './logo.svg';
import './App.css';

const registerUser = async () => {
  return await fetch('/api/users/register', {
    method: 'post',
    body: JSON.stringify({ user: 'hoge', password: 'pass' }),
    headers: { 'Content-Type': 'application/json' },
  })
    .then((res) => res.json())
    .then((res) => JSON.stringify(res));
};

function App() {
  const [res, setRes] = useState<null | string>(null);

  const onClick = async () => {
    setRes(await registerUser());
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Hello Vite + React!</p>
        <div>
          <button onClick={onClick}>Request GET /api/user</button>
          <div>
            <h2>Response</h2>
            <div>{res}</div>
          </div>
        </div>
      </header>
    </div>
  );
}

export default App;
