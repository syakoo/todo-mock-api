import { useState } from 'react';

import logo from './logo.svg';
import './App.css';

const fetchUser = async () => {
  return await fetch('/api/user').then((res) => res.json());
};

function App() {
  const [res, setRes] = useState<null | string>(null);

  const onClick = async () => {
    setRes(await fetchUser());
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
