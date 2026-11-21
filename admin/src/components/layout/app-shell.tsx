import { Suspense, type ReactNode } from "react";
import { PullToRefresh } from "@/components/pwa/pull-to-refresh";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AppBreadcrumb } from "@/components/layout/app-breadcrumb";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-canvas" data-test-selector="app-shell">
      <SidebarNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        {/* pb reserves the fixed bottom nav (--bottom-bar-inset) plus breathing room. */}
        <main className="min-w-0 flex-1 px-4 pb-[calc(var(--bottom-bar-inset)+1.5rem)] pt-4 md:px-6">
          {/* It reads the query string, which Next only allows under a Suspense boundary. */}
          <Suspense fallback={null}>
            <AppBreadcrumb />
          </Suspense>
          <PullToRefresh>{children}</PullToRefresh>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
