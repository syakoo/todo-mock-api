import { CustomError } from "../../../utils/customError";
export declare type UserErrorCode = 'ConflictUser' | 'InvalidUser' | 'MismatchedPassword' | 'UserNotFound';
export declare class UserError extends CustomError<UserErrorCode> {
}
