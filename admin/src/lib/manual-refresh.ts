// A user-asked refresh, the only cue for dropping rows a screen held against the server's latest answer.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Called by whatever gives the user a way to say "fetch it all again". */
export function notifyManualRefresh(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

export function subscribeToManualRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
