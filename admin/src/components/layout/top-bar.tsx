"use client";

import { useTranslations } from "next-intl";
import { AccountMenu } from "@/components/layout/account-menu";
import { EnvironmentBadge } from "@/components/layout/environment-badge";

// Three things only (name, sandbox chip, account); the language lives in the account menu, and the account shows at every width for every role.
export function TopBar() {
  const t = useTranslations();

  return (
    <header
      className="sticky top-0 z-30 border-b border-line bg-surface pt-[var(--safe-top)] md:border-b-0 md:bg-canvas"
      data-test-selector="top-bar"
    >
      <div className="h-[var(--top-bar-height)] px-4 md:px-6 md:py-2">
        <div className="flex h-full items-center gap-2 md:rounded-field md:border md:border-line md:bg-surface md:px-4 md:shadow-card">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-section font-semibold text-primary-700 md:hidden">{t("app.name")}</span>
            <EnvironmentBadge className="md:hidden" />
          </div>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
