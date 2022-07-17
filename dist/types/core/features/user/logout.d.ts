import type { UserState } from './types';
import type { GlobalState } from "../../globalState";
import type { WithDBStateReadonlyInput } from "../../types";
interface LogoutUserInput {
    user: UserState;
}
export declare function logoutUser(props: WithDBStateReadonlyInput<LogoutUserInput>): Promise<GlobalState>;
export {};
