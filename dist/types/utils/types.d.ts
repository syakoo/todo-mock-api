export declare type DeepReadonly<T> = {
    readonly [P in keyof T]: DeepReadonly<T[P]>;
};
export declare type DeepWriteable<T> = T extends DeepReadonly<infer I> ? I : {
    -readonly [K in keyof T]: DeepWriteable<T[K]>;
};
export declare type UnknownRecord = Record<string, unknown>;
