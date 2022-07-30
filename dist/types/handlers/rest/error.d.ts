import { type CommonErrorCode } from "../../utils/customError";
import type { TaskErrorCode } from "../../core/features/task/error";
import type { TokenErrorCode } from "../../core/features/token";
import type { UserErrorCode } from "../../core/features/user";
export declare type AppApiErrorCode = CommonErrorCode | UserErrorCode | TokenErrorCode | TaskErrorCode;
export interface AppApiError {
    code: AppApiErrorCode;
    message: string;
}
export interface HTTPErrorResponse {
    status: number;
    body: AppApiError;
}
export declare function error2HttpErrorResponse(error: unknown): HTTPErrorResponse;
