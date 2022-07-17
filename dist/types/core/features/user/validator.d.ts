import type { UserState, User } from './types';
export declare function assertValidUserName(username: unknown): asserts username is string;
export declare function assertValidPassword(password: unknown): asserts password is string;
export declare function assertValidUserId(maybeUserId: unknown): asserts maybeUserId is string;
export declare function assertValidUser(state: unknown): asserts state is User;
export declare function assertValidUserState(state: unknown): asserts state is UserState;
