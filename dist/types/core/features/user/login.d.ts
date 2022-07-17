import type { GlobalState } from "../../globalState";
import type { WithDBStateReadonlyInput } from "../../types";
interface LoginUserInput {
    username: string;
    password: string;
}
interface LoginUserReturn {
    state: GlobalState;
    outputs: {
        token: string;
    };
}
export declare function loginUser(props: WithDBStateReadonlyInput<LoginUserInput>): Promise<LoginUserReturn>;
export {};
