import { useRef } from 'react';

type RegisterAndLoginProps = {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
};

export function RegisterAndLogin(props: RegisterAndLoginProps) {
  const { login, register } = props;
  const inputUsernameRef = useRef<HTMLInputElement>(null);
  const inputPasswordRef = useRef<HTMLInputElement>(null);

  const onClickRegister = () => {
    const username = inputUsernameRef.current?.value;
    const password = inputPasswordRef.current?.value;

    if (username && password) {
      register(username, password);
    }
  };

  const onClickLogin = () => {
    const username = inputUsernameRef.current?.value;
    const password = inputPasswordRef.current?.value;

    if (username && password) {
      login(username, password);
    }
  };

  return (
    <section>
      <h1>新規登録とログイン</h1>
      <div>
        <form>
          <div>
            <label>
              <span>username: </span>
              <input type="text" ref={inputUsernameRef} />
            </label>
          </div>
          <div>
            <label>
              <span>password: </span>
              <input type="password" ref={inputPasswordRef} />
            </label>
          </div>
          <div>
            <button type="button" onClick={onClickRegister}>
              Register
            </button>
            <button type="button" onClick={onClickLogin}>
              Login
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
