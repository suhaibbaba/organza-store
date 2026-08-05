"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  PULL_REFRESH_DEAD_ZONE_PX,
  PULL_REFRESH_IGNORE_ATTRIBUTE,
  PULL_REFRESH_MAX_PX,
  PULL_REFRESH_MIN_VISIBLE_MS,
  PULL_REFRESH_RESISTANCE,
  PULL_REFRESH_SURFACE_SEARCH_DEPTH,
  PULL_REFRESH_THRESHOLD_PX,
} from "@/constants/pwa";
import { isInstalledTouchApp, isInstalledTouchAppOnServer, subscribeToInstalledTouchApp } from "@/lib/pwa";
import { cn } from "@/lib/utils";

// Pull down at the top of a screen to re-read it.
//
// Installed from the Home Screen there is no browser chrome left: no reload
// button, and no native pull-to-refresh either. That leaves someone looking
// at a number they doubt with no way to ask for it again, which on a shop
// floor is the moment they stop trusting the app. So this only runs in the
// installed app — in a tab the browser's own gesture is still there and two
// of them would fight.
//
// What it refreshes is whatever the current screen is actually reading:
// react-query's active queries. No route knowledge, so it stays right as
// screens change.
export function PullToRefresh({ children }: { children: ReactNode }) {
  const t = useTranslations("common.pullToRefresh");
  const queryClient = useQueryClient();

  // How far the content has been dragged down, in px, after resistance.
  const [distance, setDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // True while the finger is down and the pull is settling back, so the
  // content animates home instead of snapping.
  const [isSettling, setIsSettling] = useState(false);

  // Touch bookkeeping is refs, not state: it changes on every touchmove and
  // must not re-render the page under the finger.
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pullingRef = useRef(false);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);

  // Only in the installed app (see above), and only where there is a finger.
  // Read straight from the browser rather than copied into state, so it is
  // right on the first paint after hydration and stays right afterwards.
  const enabled = useSyncExternalStore(subscribeToInstalledTouchApp, isInstalledTouchApp, isInstalledTouchAppOnServer);

  const refresh = useCallback(async () => {
    refreshingRef.current = true;
    setIsRefreshing(true);
    setDistance(PULL_REFRESH_THRESHOLD_PX);
    const startedAt = performance.now();
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      // A refetch off a good connection can land in 40ms; snapping the
      // spinner away that fast reads as "nothing happened".
      const elapsed = performance.now() - startedAt;
      if (elapsed < PULL_REFRESH_MIN_VISIBLE_MS) {
        await new Promise((resolve) => setTimeout(resolve, PULL_REFRESH_MIN_VISIBLE_MS - elapsed));
      }
      refreshingRef.current = false;
      setIsRefreshing(false);
      setIsSettling(true);
      setDistance(0);
      distanceRef.current = 0;
    }
  }, [queryClient]);

  useEffect(() => {
    if (!enabled) return;

    // Anything that handles its own touches — a photo being dragged into
    // place, a numbered point being moved, an open sheet — declares itself
    // with touch-action: none (or the opt-out attribute). Starting a pull
    // from one of those would steal the gesture it was already having.
    function ownsItsTouches(target: EventTarget | null): boolean {
      let node = target instanceof Element ? target : null;
      for (let depth = 0; node && depth < PULL_REFRESH_SURFACE_SEARCH_DEPTH; depth += 1) {
        if (node.hasAttribute(PULL_REFRESH_IGNORE_ATTRIBUTE) || node.getAttribute("role") === "dialog") return true;
        if (window.getComputedStyle(node).touchAction === "none") return true;
        node = node.parentElement;
      }
      return false;
    }

    function handleTouchStart(event: TouchEvent) {
      if (refreshingRef.current || event.touches.length !== 1) return;
      // Only from the very top: mid-page this is an ordinary scroll.
      if (window.scrollY > 0) return;
      if (ownsItsTouches(event.target)) return;
      const touch = event.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchMove(event: TouchEvent) {
      const start = startRef.current;
      if (!start || refreshingRef.current) return;

      const touch = event.touches[0];
      const dy = touch.clientY - start.y;
      const dx = touch.clientX - start.x;

      if (!pullingRef.current) {
        // Scrolling up, or swiping sideways (a thumbnail strip, a tab row):
        // not ours. Let go for the rest of this gesture.
        if (dy <= PULL_REFRESH_DEAD_ZONE_PX || Math.abs(dx) > Math.abs(dy)) {
          if (dy < 0 || Math.abs(dx) > Math.abs(dy)) startRef.current = null;
          return;
        }
        pullingRef.current = true;
        setIsSettling(false);
      }

      // Past the dead zone the page follows the finger, with resistance so it
      // feels like something is being pulled rather than dragged loose.
      const pulled = Math.min(PULL_REFRESH_MAX_PX, (dy - PULL_REFRESH_DEAD_ZONE_PX) * PULL_REFRESH_RESISTANCE);
      if (pulled <= 0) return;
      // Stops the page itself from rubber-banding behind the pull.
      if (event.cancelable) event.preventDefault();
      distanceRef.current = pulled;
      setDistance(pulled);
    }

    function endGesture() {
      const pulled = distanceRef.current;
      const wasPulling = pullingRef.current;
      startRef.current = null;
      pullingRef.current = false;
      if (!wasPulling) return;

      setIsSettling(true);
      if (pulled >= PULL_REFRESH_THRESHOLD_PX) {
        void refresh();
        return;
      }
      distanceRef.current = 0;
      setDistance(0);
    }

    // touchmove must be non-passive: it is the only way to keep the page
    // from scrolling while the pull is in hand.
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", endGesture, { passive: true });
    window.addEventListener("touchcancel", endGesture, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", endGesture);
      window.removeEventListener("touchcancel", endGesture);
    };
  }, [enabled, refresh]);

  if (!enabled) return <>{children}</>;

  const isReleasable = distance >= PULL_REFRESH_THRESHOLD_PX;
  const label = isRefreshing ? t("refreshing") : isReleasable ? t("release") : t("pull");
  // Nothing in the DOM at rest: an invisible label is still a label to a
  // screen reader, and there is nothing to announce until a pull starts.
  const isVisible = distance > 0 || isRefreshing;

  return (
    <>
      {/* Centred on the viewport: a centred thing is the same in both
          directions, so there is nothing to mirror for RTL. It rides down
          with the pull and sits below the top bar and the notch, whose
          combined height the shell already names. */}
      {isVisible && (
        <div
          className="pointer-events-none fixed inset-x-0 top-[calc(var(--top-bar-inset)+0.5rem)] z-40 flex justify-center"
          style={{
            transform: `translateY(${Math.max(0, distance - PULL_REFRESH_THRESHOLD_PX / 2)}px)`,
            transition: isSettling ? "transform 200ms ease-out" : "none",
          }}
        >
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-lg">
            <RefreshCw
              className={cn("size-4 text-primary", isRefreshing && "animate-spin")}
              style={isRefreshing ? undefined : { transform: `rotate(${distance * 3}deg)` }}
              aria-hidden="true"
            />
            <span aria-live="polite">{label}</span>
          </div>
        </div>
      )}

      <div
        style={{
          transform: distance > 0 ? `translateY(${distance}px)` : undefined,
          transition: isSettling ? "transform 200ms ease-out" : "none",
        }}
      >
        {children}
      </div>
    </>
  );
}
