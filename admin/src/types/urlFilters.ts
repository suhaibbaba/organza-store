// How one list filter is read from and written to the page's query string.
export interface UrlParam<T> {
  parse: (raw: string) => T | undefined;
  // null leaves the parameter out of the URL.
  write: (value: T) => string | null;
}

export type UrlParams<T> = { [K in keyof T]: UrlParam<T[K]> };

export type FilterUpdate<T> = Partial<T> | ((current: T) => Partial<T>);
