"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AccountMenu } from "@/components/layout/account-menu";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { LOGO_ICON_SIZE, pwaIconPath } from "@/constants/pwa";

interface TopBarProps {
  // The selling screen's search and its two buttons. Beside the shop's name
  // from `desk` (1000px); below it they wrap onto a row of their own under
  // the bar, which is the design's tablet and phone layout.
  tools?: ReactNode;
}

// Which shop, which copy of it, who is signed in — and, on the selling
// screen, the way to find a product. Fixed at the top: in the full-screen
// shell on the counter's tablet there is no browser chrome above it.
export function TopBar({ tools }: TopBarProps) {
  const t = useTranslations();

  return (
    <header
      className="sticky top-0 z-30 border-b border-border bg-card pt-[var(--safe-top)]"
      data-test-selector="pos-top-bar"
    >
      <div className="flex flex-wrap items-center gap-x-3 px-3 tab:px-4 desk:flex-nowrap desk:gap-x-4 desk:px-5">
        {/* The name gives way first when the row is tight; the sandbox chip
            never does — it says which database this sale goes into. */}
        <div className="flex h-[var(--top-bar-height)] min-w-0 flex-1 items-center gap-2 desk:flex-none">
          {/* The installed app's own icon doubles as the logo, so the sandbox
              build shows its own mark here exactly as on the home screen. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed
              PWA icon, already sized; the optimiser buys nothing here. */}
          <img
            src={pwaIconPath(LOGO_ICON_SIZE)}
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-[10px]"
          />
          <span className="truncate text-lg font-bold">{t("app.name")}</span>
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

        <AccountMenu className="shrink-0" />
      </div>
    </header>
  );
}
