"use client";

import type { ReactNode } from "react";
import { AccountMenu } from "@/components/layout/account-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { useStoreName } from "@/hooks/use-store-name";
import { LOGO_ICON_SIZE, pwaIconPath } from "@/constants/pwa";

interface TopBarProps {
  // The selling screen's search and buttons: beside the logo from `desk`, on their own row below it.
  tools?: ReactNode;
}

export function TopBar({ tools }: TopBarProps) {
  const storeName = useStoreName();

  return (
    <header
      className="sticky top-0 z-30 border-b border-line bg-surface pt-[var(--safe-top)] shadow-pill"
      data-test-selector="pos-top-bar"
    >
      <div className="flex flex-wrap items-center gap-x-3 px-3 tab:px-4 desk:flex-nowrap desk:gap-x-4 desk:px-5">
        {/* The sandbox chip never gives way: it says which database this sale goes into. */}
        <div className="flex h-[var(--top-bar-height)] min-w-0 flex-1 items-center gap-2 desk:flex-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed, pre-sized PWA icon. */}
          <img
            src={pwaIconPath(LOGO_ICON_SIZE)}
            alt={storeName}
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-control"
          />
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
        </div>
      </div>
    </header>
  );
}
