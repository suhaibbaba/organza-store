"use client";

import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { useSession } from "@/components/providers/session-provider";

export function TopBar() {
  const t = useTranslations();
  const { user, logout } = useSession();

  const initials = user?.name ? user.name.trim().slice(0, 1).toUpperCase() : "?";

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:h-16 md:px-6">
      <span className="text-base font-semibold md:text-lg">{t("app.name")}</span>

      {/* On mobile, language + logout live in the bottom nav's "More" sheet instead. */}
      <div className="hidden items-center gap-4 md:flex">
        <LanguageSwitcher variant="dropdown" />
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">{user?.name}</span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
          <LogOut className="size-4" aria-hidden="true" />
          {t("common.logout")}
        </Button>
      </div>
    </header>
  );
}
