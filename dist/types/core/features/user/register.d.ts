import type { WithDBStateReadonlyInput } from '../../types';
import type { GlobalState } from "../../globalState";
interface RegisterUserInput {
    username: string;
    password: string;
}
export declare function registerUser(props: WithDBStateReadonlyInput<RegisterUserInput>): Promise<GlobalState>;
export {};
