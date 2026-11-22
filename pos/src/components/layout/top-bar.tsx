"use client";

import type { ReactNode } from "react";
import { AccountMenu } from "@/components/layout/account-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { ShopLogo } from "@/components/brand/shop-logo";
import { WindowControls } from "@/components/layout/window-controls";
import { DESKTOP_DRAG_REGION } from "@/constants/desktop";

interface TopBarProps {
  // The selling screen's search and buttons: beside the logo from `desk`, on their own row below it.
  tools?: ReactNode;
}

// The admin's header: a white bar on phones and tablets, a floating card on the canvas from `desk`.
export function TopBar({ tools }: TopBarProps) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-line bg-surface pt-[var(--safe-top)] desk:border-b-0 desk:bg-canvas"
      data-test-selector="pos-top-bar"
      {...DESKTOP_DRAG_REGION}
    >
      <div {...DESKTOP_DRAG_REGION} className="px-3 tab:px-4 desk:px-4 desk:pt-3">
        <div
          {...DESKTOP_DRAG_REGION}
          className="flex flex-wrap items-center gap-x-3 desk:flex-nowrap desk:gap-x-4 desk:rounded-field desk:border desk:border-line desk:bg-surface desk:px-3 desk:shadow-card"
        >
          {/* The sandbox chip never gives way: it says which database this sale goes into. */}
          <div
            {...DESKTOP_DRAG_REGION}
            className="flex h-[var(--top-bar-height)] min-w-0 flex-1 items-center gap-2 desk:h-[calc(var(--top-bar-height)-0.75rem)] desk:flex-none"
          >
            <ShopLogo className="h-9 w-auto max-w-32 shrink-0" />
            <EnvironmentBadge />
          </div>

          {tools && (
            <div
              className="order-last flex w-full min-w-0 items-center gap-2 pb-3 desk:order-none desk:w-auto desk:flex-1 desk:pb-0"
              data-test-selector="pos-top-bar-tools"
            >
              {tools}
            </div>
          )}

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher variant="pill" />
            <AccountMenu />
            <WindowControls />
          </div>
        </div>
      </div>
    </header>
  );
}
