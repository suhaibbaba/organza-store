import { focusManager } from "@tanstack/react-query";
import { INACTIVE_AFTER_BLUR_MS } from "@/constants/polling";

// Decides whether stock queries poll; stricter than visibilityState, since a till left open isn't one in use.
export function trackTillActivity(): () => void {
  focusManager.setEventListener((setFocused) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    let blurTimer: ReturnType<typeof setTimeout> | undefined;

    function cancelBlurTimer() {
      if (blurTimer === undefined) {
        return;
      }
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
      // Hidden takes effect at once rather than waiting out the blur delay.
      if (document.visibilityState === "hidden") {
        inactive();
      } else {
        active();
      }
    }

    function handleBlur() {
      if (document.visibilityState === "hidden") {
        return;
      }
      cancelBlurTimer();
      blurTimer = setTimeout(() => setFocused(false), INACTIVE_AFTER_BLUR_MS);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange, false);
    window.addEventListener("focus", active, false);
    window.addEventListener("blur", handleBlur, false);
    // Chromium freezes a backgrounded tab or PWA; stating it keeps the state right the instant it thaws.
    document.addEventListener("freeze", inactive, false);
    document.addEventListener("resume", active, false);
    // On iOS a backgrounded PWA gets the back/forward cache, not freeze.
    window.addEventListener("pagehide", inactive, false);
    window.addEventListener("pageshow", active, false);

    // Start from what is true now, in case the app loaded in a background tab.
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

  // Restores react-query's own listener and clears the stored flag, or a hot reload leaves it stuck.
  return () => {
    focusManager.setEventListener(defaultFocusListener);
    focusManager.setFocused(undefined);
  };
}

// react-query's stock listener, restored on teardown.
function defaultFocusListener(handleFocus: (focused?: boolean) => void): (() => void) | undefined {
  if (typeof window === "undefined" || !window.addEventListener) {
    return;
  }
  const listener = () => handleFocus();
  window.addEventListener("visibilitychange", listener, false);
  return () => window.removeEventListener("visibilitychange", listener);
}
