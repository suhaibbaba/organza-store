/**
 * The access token lives in memory only. The refresh token is an httpOnly cookie on the web
 * and in the OS secure store on desktop (see token-store.ts); script never reads either.
 */
type Listener = () => void;

let accessToken: string | null = null;
const endedListeners = new Set<Listener>();

export const authTokens = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  onSessionEnded(listener: Listener): () => void {
    endedListeners.add(listener);
    return () => endedListeners.delete(listener);
  },
  notifySessionEnded() {
    accessToken = null;
    endedListeners.forEach((l) => l());
  },
};
