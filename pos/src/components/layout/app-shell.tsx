import type { ReactNode } from "react";
import { PullToRefresh } from "@/components/pwa/pull-to-refresh";
import { TopBar } from "@/components/layout/top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    // pb: nothing is docked at the bottom here except the selling screen's
    // checkout bar (which the page reserves room for itself), so all the
    // shell has to keep clear of is the iOS home indicator — otherwise the
    // last line of any screen ends up under it.
    <div className="min-h-dvh pb-[var(--bottom-bar-inset)]">
      <TopBar />
      {/* Wraps the selling screen itself: the gesture is only listened for
          over the page's own content, and the indicator it raises floats
          above it without moving anything. */}
      <PullToRefresh>{children}</PullToRefresh>
    </div>
  );
}
