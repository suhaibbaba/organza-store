"use client";

import { Drawer } from "@store/ui";
import { NavTree } from "@/components/layout/nav-tree";
import { EnvironmentBadge } from "@/components/layout/environment-badge";
import { ShopLogo } from "@/components/brand/shop-logo";
import type { NavItem } from "@/types/nav";

interface MenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
}

export function MenuSheet({ open, onOpenChange, items }: MenuSheetProps) {
  return (
    <Drawer
      side="start"
      size="sm"
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <ShopLogo className="h-9 w-auto max-w-28" />
          <EnvironmentBadge />
        </span>
      }
      descriptionKey="nav.menu"
      data-testid="sheet-nav-menu"
    >
      <nav className="-mx-2">
        <NavTree items={items} itemSelector="menu-item" onNavigate={() => onOpenChange(false)} />
      </nav>
    </Drawer>
  );
}
