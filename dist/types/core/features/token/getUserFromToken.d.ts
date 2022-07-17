import type { UserState } from "../user";
import type { WithDBStateReadonlyInput } from "../../types";
interface GetUserFromTokenInput {
    maybeBearerToken: string | null;
}
export declare function getUserFromToken(props: WithDBStateReadonlyInput<GetUserFromTokenInput>): Promise<UserState>;
export {};
