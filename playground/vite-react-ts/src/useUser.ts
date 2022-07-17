import { client } from '@syakoo/todo-mock-api';
import { useCallback, useState } from 'react';

export function useUser() {
  const [token, setToken] = useState<null | string>(null);

  const register = useCallback(async (username: string, password: string) => {
    await client.restApi.users.register.post({
      username,
      password,
    });
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await client.restApi.users.login.post({ username, password });

    if (res.ok) {
      setToken(res.body.token);
    }
  }, []);

  const logout = useCallback(async () => {
    if (!token) return;
    await client.restApi.users.logout.post(token);
  }, [token]);

  return { login, register, logout, token };
}
