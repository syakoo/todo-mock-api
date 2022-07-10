import { useEffect, useState } from 'react';

import logo from './logo.svg';
import './App.css';

function App() {
  const [res, setRes] = useState<null | string>(null);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const healthCheck = async () => {
    const result = await fetch('/api/health', {
      method: 'get',
    })
      .then((res) => res.json())
      .then((res) => JSON.stringify(res));

    setRes(result);
  };

  const register = async () => {
    const result = await fetch('/api/users/register', {
      method: 'post',
      body: JSON.stringify({ username: user, password }),
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.json())
      .then((res) => JSON.stringify(res));

    setRes(result);
  };

  const login = async () => {
    const result = await fetch('/api/users/login', {
      method: 'post',
      body: JSON.stringify({ username: user, password }),
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => res.json())
      .then((res) => JSON.stringify(res));

    if (JSON.parse(result).token) {
      setToken(JSON.parse(result).token);
    }

    setRes(result);
  };

  const logout = async () => {
    const result = await fetch('/api/users/logout', {
      method: 'post',
      body: JSON.stringify({ user, password }),
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((res) => JSON.stringify(res));

    setRes(result);
  };

  useEffect(() => {
    if (!res) {
      healthCheck();
    }
  }, [res]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>Hello Vite + React!</p>
        <div>token: {token}</div>
        <div>
          <div>
            <input
              type="text"
              onChange={(e) => {
                setUser(e.target.value);
              }}
              value={user}
            />
          </div>
          <div>
            <input
              type="text"
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              value={password}
            />
          </div>
          <button onClick={register}>Register</button>
          <button onClick={login}>Login</button>
          <button onClick={logout}>Logout</button>
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
