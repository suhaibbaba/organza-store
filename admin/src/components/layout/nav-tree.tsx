"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { usePathname } from "@/i18n/navigation";
import { NavPendingBadge } from "@/components/change-requests/nav-pending-badge";
import { DESIGN_SYSTEM_HREF, DesignSystemNavLink, NavLink, useShowsDesignSystem } from "@/components/layout/nav-link";
import { DESIGN_SYSTEM_NAV_GROUP, NAV_TREE } from "@/constants/nav";
import { activeHref } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import type { LucideIcon } from "lucide-react";
import type { NavGroupKey, NavItem } from "@/types/nav";

type ResolvedEntry =
  | { kind: "item"; item: NavItem }
  | { kind: "group"; key: NavGroupKey; icon: LucideIcon; items: NavItem[]; withDesignSystem: boolean };

interface NavTreeProps {
  items: readonly NavItem[];
  // Family name of each link: the sidebar's "nav-item", the phone menu's "menu-item".
  itemSelector: string;
  onRail?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}

// Only what the role may see; a group left with one page shows that page on its own.
function resolve(items: readonly NavItem[], showsDesignSystem: boolean): ResolvedEntry[] {
  const byKey = new Map(items.map((item) => [item.key, item]));
  return NAV_TREE.flatMap((entry): ResolvedEntry[] => {
    if (entry.kind === "item") {
      const item = byKey.get(entry.key);
      return item ? [{ kind: "item", item }] : [];
    }
    const visible = entry.items.flatMap((key) => byKey.get(key) ?? []);
    const withDesignSystem = entry.key === DESIGN_SYSTEM_NAV_GROUP && showsDesignSystem;
    if (visible.length + (withDesignSystem ? 1 : 0) === 0) {
      return [];
    }
    if (visible.length === 1 && !withDesignSystem) {
      return [{ kind: "item", item: visible[0] }];
    }
    return [{ kind: "group", key: entry.key, icon: entry.icon, items: visible, withDesignSystem }];
  });
}

export function NavTree({ items, itemSelector, onRail = false, collapsed = false, onNavigate }: NavTreeProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const showsDesignSystem = useShowsDesignSystem();
  const active = activeHref(pathname, items);
  const entries = resolve(items, showsDesignSystem);
  const activeGroup = entries.find(
    (entry): entry is Extract<ResolvedEntry, { kind: "group" }> =>
      entry.kind === "group" &&
      (entry.items.some((item) => item.href === active) || (entry.withDesignSystem && pathname === DESIGN_SYSTEM_HREF)),
  )?.key;

  // The group holding the current page opens on arrival; the rest stay as the user left them.
  const [open, setOpen] = useState<ReadonlySet<NavGroupKey>>(() => new Set(activeGroup ? [activeGroup] : []));
  const [openedFor, setOpenedFor] = useState(activeGroup);
  if (activeGroup !== openedFor) {
    setOpenedFor(activeGroup);
    if (activeGroup && !open.has(activeGroup)) {
      setOpen(new Set([...open, activeGroup]));
    }
  }

  function toggle(key: NavGroupKey) {
    const next = new Set(open);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setOpen(next);
  }

  const link = (item: NavItem, nested = false) => (
    <NavLink
      key={item.key}
      href={item.href}
      icon={item.icon}
      label={t(item.key)}
      isActive={item.href === active}
      testSelector={testSelectorFor(itemSelector, item.key)}
      onClick={onNavigate}
      onRail={onRail}
      collapsed={collapsed}
      nested={nested}
      trailing={item.key === "changeRequests" ? <NavPendingBadge className="ms-auto" /> : undefined}
    />
  );

  // A slim rail has no room for headings: every page is an icon, groups split by a line.
  if (collapsed) {
    return (
      <ul>
        {entries.map((entry, index) =>
          entry.kind === "item" ? (
            link(entry.item)
          ) : (
            <Fragment key={entry.key}>
              {index > 0 && <li aria-hidden="true" className="mx-3 my-2 border-t border-rail-line" />}
              {entry.items.map((item) => link(item))}
              {entry.withDesignSystem && <DesignSystemNavLink pathname={pathname} onRail={onRail} collapsed />}
              {index < entries.length - 1 && entries[index + 1].kind === "item" && (
                <li aria-hidden="true" className="mx-3 my-2 border-t border-rail-line" />
              )}
            </Fragment>
          ),
        )}
      </ul>
    );
  }

  return (
    <ul>
      {entries.map((entry) => {
        if (entry.kind === "item") {
          return link(entry.item);
        }
        const isOpen = open.has(entry.key);
        const holdsActive = entry.key === activeGroup;
        const GroupIcon = entry.icon;
        const bodyId = `nav-group-${itemSelector}-${entry.key}`;
        return (
          <li key={entry.key} data-test-selector={testSelectorFor("nav-group", entry.key)}>
            <button
              type="button"
              onClick={() => toggle(entry.key)}
              aria-expanded={isOpen}
              aria-controls={bodyId}
              data-test-selector={testSelectorFor("nav-group-toggle", entry.key)}
              className={cn(
                "mb-0.5 flex min-h-11 w-full cursor-pointer items-center gap-[11px] rounded-nav px-3 text-start",
                "text-label font-medium transition-colors duration-150",
                onRail
                  ? cn(
                      "hover:bg-rail-hover hover:text-rail-hover-ink focus-visible:bg-rail-active focus-visible:text-rail-ink-active",
                      holdsActive && !isOpen ? "bg-rail-hover text-rail-hover-ink" : "text-rail-ink",
                    )
                  : cn(
                      "hover:bg-primary-100 hover:text-primary-700 focus-visible:bg-primary-200 focus-visible:text-primary-800",
                      holdsActive && !isOpen ? "bg-primary-50 text-primary-700" : "text-ink-muted",
                    ),
              )}
            >
              <GroupIcon className="size-[19px] shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate whitespace-nowrap">{t(`groups.${entry.key}`)}</span>
              <ChevronDown
                className={cn("size-4 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            <div
              id={bodyId}
              inert={!isOpen}
              className={cn(
                "grid transition-[grid-template-rows] duration-200 ease-glide",
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
              )}
            >
              <ul
                className={cn(
                  "ms-[21px] min-h-0 overflow-hidden border-s ps-2",
                  onRail ? "border-rail-line" : "border-line",
                )}
              >
                {entry.items.map((item) => link(item, true))}
                {entry.withDesignSystem && (
                  <DesignSystemNavLink pathname={pathname} onClick={onNavigate} onRail={onRail} nested />
                )}
              </ul>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
