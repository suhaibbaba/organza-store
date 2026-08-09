// A refresh the USER asked for, as opposed to one react-query decided on.
//
// The difference matters to any screen that deliberately holds something on
// display against the server's latest answer — the inventory list keeps a row
// the user's own edit pushed outside the active filter, so it doesn't vanish
// under their finger. That row has to go at some point, and "the user asked
// for the list again" is the only honest cue: a background refetch, or the
// refetch triggered by the save itself, must not count.
//
// A plain module-level set rather than a context: the two ends are far apart
// (the pull-to-refresh gesture lives in the app shell, the screens that care
// are several levels down) and there is exactly one app per tab.

type Listener = () => void;

const listeners = new Set<Listener>();

/** Called by whatever gives the user a way to say "fetch it all again". */
export function notifyManualRefresh(): void {
  for (const listener of [...listeners]) listener();
}

export function subscribeToManualRefresh(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
