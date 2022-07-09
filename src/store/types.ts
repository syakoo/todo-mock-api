export interface Store<T = object> {
  getData: () => T | null;
  setData: (data: T) => void;
}
