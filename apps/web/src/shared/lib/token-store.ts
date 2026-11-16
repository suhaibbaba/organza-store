/**
 * Where a refresh token is kept when the platform cannot use an httpOnly cookie. The web build
 * uses the cookie, so this store is a no-op there; the desktop shell installs an implementation
 * backed by the OS secure store (Windows Credential Manager, Linux Secret Service).
 */
export interface TokenStore {
  readonly kind: 'cookie' | 'secure-store';
  load(): Promise<string | null>;
  save(token: string): Promise<void>;
  clear(): Promise<void>;
}

const cookieStore: TokenStore = {
  kind: 'cookie',
  load: async () => null,
  save: async () => undefined,
  clear: async () => undefined,
};

let current: TokenStore = cookieStore;

export const tokenStore = {
  get: (): TokenStore => current,
  install: (store: TokenStore) => {
    current = store;
  },
};
