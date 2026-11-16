import { focusManager } from "@tanstack/react-query";
import { INACTIVE_AFTER_BLUR_MS } from "@/constants/polling";

// Whether this till is being used right now — which is what decides whether
// the stock queries poll (see hooks/use-product-search.ts) and whether coming
// back to the app re-reads them.
//
// react-query's own answer to that question is `document.visibilityState`,
// and on a phone that is very nearly right: a backgrounded PWA and a hidden
// tab both go `hidden`, and polling stops. It is wrong in one direction that
// matters on the counter's laptop, where the app is installed as a desktop
// PWA: a window sitting behind another one is still `visible`, so a till
// nobody has touched since this morning would keep asking the API for stock
// all day.
//
// So visibility is kept, and an unfocused-but-visible window is added to it
// on a delay (INACTIVE_AFTER_BLUR_MS) — long enough that the constant, brief
// focus losses of a working counter are ignored, short enough that a window
// left behind another one stops within the minute.
//
// What this does NOT have to handle:
//   - going offline. react-query's onlineManager already pauses every fetch
//     while `navigator.onLine` is false (the default `networkMode: "online"`),
//     and `refetchOnReconnect` re-reads on the way back.
//   - which SCREEN is open. Only the selling screen's queries carry a
//     refetchInterval, and react-query stops an interval the moment its query
//     has no observers — so a till sitting on the login screen polls nothing
//     whatever this reports.
//
// Turning "focused" back on is what makes the first thing a returning cashier
// sees be current: react-query refetches every stale query on that edge
// (`refetchOnWindowFocus`), and the stock queries are always stale.
export function trackTillActivity(): () => void {
  focusManager.setEventListener((setFocused) => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let blurTimer: ReturnType<typeof setTimeout> | undefined;

    function cancelBlurTimer() {
      if (blurTimer === undefined) return;
      clearTimeout(blurTimer);
      blurTimer = undefined;
    }

    function active() {
      cancelBlurTimer();
      setFocused(true);
    }

    function inactive() {
      cancelBlurTimer();
      setFocused(false);
    }

    function handleVisibilityChange() {
      // Hidden is unambiguous — a background tab, a minimised window, a PWA
      // swiped away on a phone — and it takes effect at once rather than
      // waiting out the blur delay, because none of those are "glanced away
      // from".
      if (document.visibilityState === "hidden") inactive();
      else active();
    }

    function handleBlur() {
      // A hidden window is already handled, and handling it twice would only
      // replace an immediate stop with a delayed one.
      if (document.visibilityState === "hidden") return;
      cancelBlurTimer();
      blurTimer = setTimeout(() => setFocused(false), INACTIVE_AFTER_BLUR_MS);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange, false);
    window.addEventListener("focus", active, false);
    window.addEventListener("blur", handleBlur, false);
    // Chromium freezes a backgrounded tab or installed PWA to save the
    // battery, and restores it on the way back. A frozen page's timers do not
    // run anyway; saying so explicitly means the state is already correct the
    // instant it thaws, rather than one event late.
    document.addEventListener("freeze", inactive, false);
    document.addEventListener("resume", active, false);
    // Into and out of the back/forward cache — on iOS this, not `freeze`, is
    // what a PWA sent to the background gets.
    window.addEventListener("pagehide", inactive, false);
    window.addEventListener("pageshow", active, false);

    // Start from what is true now rather than from react-query's assumption,
    // in case the app was loaded into a tab that is already in the background.
    handleVisibilityChange();

    return () => {
      cancelBlurTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", active);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("freeze", inactive);
      document.removeEventListener("resume", active);
      window.removeEventListener("pagehide", inactive);
      window.removeEventListener("pageshow", active);
    };
  });

  // Hands the manager back to its own default listener, so a hot reload or a
  // test that unmounts the provider doesn't leave the app permanently stuck
  // on whichever state it was last told. Clearing the stored boolean is the
  // half that actually matters: react-query only consults the document's own
  // visibility while nobody has set an explicit value, so tearing down while
  // inactive would otherwise pin the app "not in use" for the rest of its life.
  return () => {
    focusManager.setEventListener(defaultFocusListener);
    focusManager.setFocused(undefined);
  };
}

// react-query's stock listener, restored on teardown.
function defaultFocusListener(handleFocus: (focused?: boolean) => void): (() => void) | undefined {
  if (typeof window === "undefined" || !window.addEventListener) return;
  const listener = () => handleFocus();
  window.addEventListener("visibilitychange", listener, false);
  return () => window.removeEventListener("visibilitychange", listener);
}
