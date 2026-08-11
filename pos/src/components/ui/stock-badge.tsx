"use client";

import { useTranslations } from "next-intl";
import { Ban, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { resolveStockStatus } from "@organza/shared/lib/stock";
import type { StockStatus } from "@organza/shared/types/inventory";
import { useLowStockThreshold } from "@/hooks/use-low-stock-threshold";
import { cn } from "@/lib/utils";

interface StockBadgeProps {
  stock: number;
  // The product's opt-in low-stock flag (Product.trackLowStock). A variant
  // inherits its parent's — a variant has none of its own. Without it, every
  // one-off piece in the shop (stock = 1, which is most of them) would sit
  // there in amber and the colour would stop meaning anything.
  trackLowStock: boolean;
  // Whether the quantity itself is worth saying. Off where the number is
  // already on screen beside this, or where there is no room for it.
  showCount?: boolean;
  // "sm" for the numbered-shawl tiles, which are a third of a phone's width:
  // the label has to keep fitting there, because the label is what makes this
  // readable to somebody who can't tell the three colours apart.
  size?: "sm" | "md";
  className?: string;
}

// Red, amber or green — the one thing on the screen that says whether the
// cashier can sell this.
//
// It is the same component wherever a quantity or an availability appears —
// the search results, the variant picker, the cart — so a colour learned in
// one place is already understood in the next. Its twin in the admin
// (components/inventory/stock-badge.tsx) draws the same three states the same
// way from the same tokens.
//
// The colour is never the message. Every state spells itself out in words as
// well, and carries a differently SHAPED icon, so the badge still says what it
// says to somebody who cannot tell red from green — or to anyone reading it in
// the sunlight at the shop counter.
export function StockBadge({ stock, trackLowStock, showCount = false, size = "md", className }: StockBadgeProps) {
  const t = useTranslations("stock");
  const threshold = useLowStockThreshold();
  const status = resolveStockStatus({ stock, trackLowStock, threshold });
  const { icon: Icon, tone } = STOCK_BADGE_STYLES[status];

  // Nothing left is nothing left: a count of zero adds nothing to the words
  // "out of stock", so that state never carries one.
  const label =
    status === "OUT"
      ? t("out")
      : status === "LOW"
        ? showCount
          ? t("lowCount", { count: stock })
          : t("low")
        : showCount
          ? t("inCount", { count: stock })
          : t("in");

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full font-medium",
        size === "sm" ? "gap-0.5 px-1.5 py-0.5 text-[11px]" : "gap-1 px-2 py-0.5 text-xs",
        tone,
        className
      )}
    >
      <Icon className={cn("shrink-0", size === "sm" ? "size-3" : "size-3.5")} aria-hidden="true" />
      {/* min-w-0 + truncate so a long Arabic label in a narrow variant tile
          shortens instead of pushing the tile wider than its grid column. */}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

// The three tones, in one place. Each is the same colour twice — a 10% wash
// behind text at full strength — which is what keeps them legible on the card
// surfaces they sit on, in light mode and dark alike. The tokens themselves
// live in app/globals.css.
const STOCK_BADGE_STYLES: Readonly<Record<StockStatus, { icon: LucideIcon; tone: string }>> = {
  OUT: { icon: Ban, tone: "bg-destructive/10 text-destructive" },
  LOW: { icon: TriangleAlert, tone: "bg-warning/10 text-warning" },
  IN: { icon: CircleCheck, tone: "bg-success/10 text-success" },
};
