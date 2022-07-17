export interface User {
  username: string;
  password: string;
  token?: string;
}

export interface UserState extends User {
  id: string;
}
