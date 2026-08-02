"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useVisibleNavItems } from "@/hooks/use-visible-nav-items";
import { cn } from "@/lib/utils";

export function SidebarNav() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const items = useVisibleNavItems();

  return (
    <aside
      className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 border-e border-border md:block"
      aria-label={tCommon("mainNavigation")}
    >
      <nav className="flex flex-col gap-1 p-3">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium",
                isActive ? "bg-secondary text-secondary-foreground" : "text-foreground hover:bg-accent"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-5" aria-hidden="true" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
