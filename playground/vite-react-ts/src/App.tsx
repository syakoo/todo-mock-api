import { RegisterAndLogin } from './RegisterAndLogin';
import { TodoApp } from './TodoApp';
import { useUser } from './useUser';

function App() {
  console.log('<App />');
  const { token, login, register } = useUser();

  if (!token) {
    return <RegisterAndLogin login={login} register={register} />;
  }

  return <TodoApp token={token} />;
}

function Container() {
  return (
    <main className="main">
      <App />
    </main>
  );
}

export default Container;
