export type DeepReadonly<T> = {
  readonly [P in keyof T]: DeepReadonly<T[P]>;
};

export type DeepWriteable<T> = T extends DeepReadonly<infer I>
  ? I
  : {
      -readonly [K in keyof T]: DeepWriteable<T[K]>;
    };
