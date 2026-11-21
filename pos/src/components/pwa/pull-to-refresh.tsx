"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import {
  PULL_REFRESH_DEAD_ZONE_PX,
  PULL_REFRESH_IGNORE_ATTRIBUTE,
  PULL_REFRESH_INDICATOR_TRAVEL_RATIO,
  PULL_REFRESH_MAX_PX,
  PULL_REFRESH_MIN_VISIBLE_MS,
  PULL_REFRESH_RESISTANCE,
  PULL_REFRESH_SURFACE_SEARCH_DEPTH,
  PULL_REFRESH_THRESHOLD_PX,
} from "@/constants/pwa";
import { isInstalledTouchApp, isInstalledTouchAppOnServer, subscribeToInstalledTouchApp } from "@/lib/pwa";
import { cn } from "@/lib/utils";

// Pull to refetch the active queries — installed app only, where there is no browser reload; in a tab the browser's own gesture would fight it.
export function PullToRefresh({ children }: { children: ReactNode }) {
  const t = useTranslations("common.pullToRefresh");
  const queryClient = useQueryClient();

  // How far the finger has travelled, in px, after resistance.
  const [distance, setDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // True once the finger is up, so the indicator animates rather than snaps.
  const [isSettling, setIsSettling] = useState(false);

  // Refs, not state: must not re-render the page on every touchmove.
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const pullingRef = useRef(false);
  const distanceRef = useRef(0);
  const refreshingRef = useRef(false);

  const enabled = useSyncExternalStore(subscribeToInstalledTouchApp, isInstalledTouchApp, isInstalledTouchAppOnServer);

  const refresh = useCallback(async () => {
    refreshingRef.current = true;
    setIsRefreshing(true);
    setDistance(PULL_REFRESH_THRESHOLD_PX);
    const startedAt = performance.now();
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      // A 40ms refetch would snap the spinner away and read as "nothing happened".
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

    // Surfaces that own their touches (touch-action: none, the opt-out attribute, a dialog) never start a pull.
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
        // Scrolling up or swiping sideways: not ours for the rest of this gesture.
        if (dy <= PULL_REFRESH_DEAD_ZONE_PX || Math.abs(dx) > Math.abs(dy)) {
          if (dy < 0 || Math.abs(dx) > Math.abs(dy)) startRef.current = null;
          return;
        }
        pullingRef.current = true;
        setIsSettling(false);
      }

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

    // touchmove is non-passive: the only way to stop the page scrolling during a pull.
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
  // Nothing in the DOM at rest, so a screen reader has nothing to announce.
  const isVisible = distance > 0 || isRefreshing;

  return (
    <>
      {/* An overlay only: dragging the page would tear it from the fixed top bar and checkout bar. */}
      {isVisible && (
        <div
          className="pointer-events-none fixed inset-x-0 top-[calc(var(--top-bar-inset)+0.5rem)] z-40 flex justify-center"
          style={{
            transform: `translateY(${distance * PULL_REFRESH_INDICATOR_TRAVEL_RATIO}px)`,
            opacity: Math.min(1, distance / PULL_REFRESH_THRESHOLD_PX),
            transition: isSettling ? "transform 200ms ease-out, opacity 200ms ease-out" : "none",
          }}
        >
          <div className="flex items-center gap-2 rounded-pill border border-line bg-surface px-3 py-1.5 text-label font-medium text-ink shadow-float">
            <RefreshCw
              className={cn("size-4 text-primary-600", isRefreshing && "animate-spin")}
              style={isRefreshing ? undefined : { transform: `rotate(${distance * 3}deg)` }}
              aria-hidden="true"
            />
            <span aria-live="polite">{label}</span>
          </div>
        </div>
      )}

      {children}
    </>
  );
}
