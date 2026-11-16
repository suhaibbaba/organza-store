import type { ReactNode } from "react";
import { PullToRefresh } from "@/components/pwa/pull-to-refresh";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { BottomNav } from "@/components/layout/bottom-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <TopBar />
      <div className="flex">
        <SidebarNav />
        {/* pb: the bottom nav is fixed, so it covers the end of the page
            unless the scrolling content reserves exactly what the nav (plus
            the home indicator under it) takes — --bottom-bar-inset, the same
            value the nav sizes itself from. The extra 1.5rem is ordinary
            breathing room, and is all that is left from md up, where the
            inset collapses to the safe area alone. */}
        <main className="min-w-0 flex-1 px-4 pb-[calc(var(--bottom-bar-inset)+1.5rem)] pt-4 md:px-6">
          {/* Wraps the page's own content, not the bars: the gesture is only
              listened for over the page itself, and the indicator it raises
              floats above it without moving anything. */}
          <PullToRefresh>{children}</PullToRefresh>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
