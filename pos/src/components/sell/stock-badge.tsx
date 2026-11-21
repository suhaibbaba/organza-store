"use client";

import { useTranslations } from "next-intl";
import { Badge, type BadgeTone, type IconName } from "@store/ui";
import { resolveStockStatus } from "@organza/shared/lib/stock";
import type { StockStatus } from "@organza/shared/types/inventory";
import { useLowStockThreshold } from "@/hooks/use-low-stock-threshold";
import { cn } from "@/lib/utils";

interface StockBadgeProps {
  stock: number;
  // The product's opt-in low-stock flag; without it every one-off piece (stock = 1) would sit in amber.
  trackLowStock: boolean;
  showCount?: boolean;
  // "sm" for the numbered-shawl tiles, a third of a phone's width.
  size?: "sm" | "md";
  // "pill" is drawn over a product photo and stays legible over any picture.
  appearance?: "badge" | "pill";
  className?: string;
}

// The colour is never the message: every state also spells itself out and carries a differently shaped icon.
export function StockBadge({
  stock,
  trackLowStock,
  showCount = false,
  size = "md",
  appearance = "badge",
  className,
}: StockBadgeProps) {
  const t = useTranslations("stock");
  const threshold = useLowStockThreshold();
  const status = resolveStockStatus({ stock, trackLowStock, threshold });

  // A count of zero adds nothing to "out of stock".
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

  if (appearance === "pill") {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-pill px-2 py-0.5 text-micro font-semibold shadow-chip",
          STOCK_PILL_STYLES[status].tone,
          className
        )}
        data-test-selector="pos-stock-pill"
      >
        {status !== "OUT" && (
          <span className={cn("size-1.5 shrink-0 rounded-pill", STOCK_PILL_STYLES[status].dot)} aria-hidden="true" />
        )}
        <span className="min-w-0 truncate">{label}</span>
      </span>
    );
  }

  // 12px even at "sm": zoom is off, and "nearly out" is the word somebody has to catch mid-sale.
  return (
    <Badge
      tone={STOCK_BADGE_STYLES[status].tone}
      icon={STOCK_BADGE_STYLES[status].icon}
      className={cn(
        "max-w-full font-semibold",
        size === "sm" ? "h-auto gap-0.5 px-1.5 py-0.5 text-micro" : "h-auto gap-1 px-2 py-0.5 text-micro",
        className
      )}
    >
      {label}
    </Badge>
  );
}

const STOCK_BADGE_STYLES: Readonly<Record<StockStatus, { icon: IconName; tone: BadgeTone }>> = {
  OUT: { icon: "error", tone: "danger" },
  LOW: { icon: "alert", tone: "warning" },
  IN: { icon: "check", tone: "success" },
};

const STOCK_PILL_STYLES: Readonly<Record<StockStatus, { tone: string; dot: string }>> = {
  OUT: { tone: "bg-danger-600 text-ink-inverse", dot: "" },
  LOW: { tone: "bg-surface text-warning-800", dot: "bg-warning-500" },
  IN: { tone: "bg-surface text-ink", dot: "bg-success-600" },
};
