export declare type CommonErrorCode = 'ValidateError' | 'UnexpectedError';
/**
 * エラークラス
 */
export declare class CustomError<T extends string = string> extends Error {
    code: T | CommonErrorCode;
    constructor(message: string, code: T | CommonErrorCode);
    toJson(): {
        code: CommonErrorCode | T;
        message: string;
    };
}
