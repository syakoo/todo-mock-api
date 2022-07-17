import { CustomError } from "../../../utils/customError";
export declare type TokenErrorCode = 'InvalidToken' | 'MismatchedToken' | 'TokenRequired';
export declare class TokenError extends CustomError<TokenErrorCode> {
}
