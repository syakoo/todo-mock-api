import { type CommonErrorCode } from "../../utils/customError";
import type { TaskErrorCode } from "../../core/features/task/error";
import type { TokenErrorCode } from "../../core/features/token";
import type { UserErrorCode } from "../../core/features/user";
export declare type AppErrorCode = CommonErrorCode | UserErrorCode | TokenErrorCode | TaskErrorCode;
export interface HTTPErrorResponseBody {
    code: AppErrorCode;
    message: string;
}
export interface HTTPErrorResponse {
    status: number;
    body: HTTPErrorResponseBody;
}
export declare function error2HttpErrorResponse(error: unknown): HTTPErrorResponse;
