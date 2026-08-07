import { useTranslations } from "next-intl";
import { Ban, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { resolveStockStatus } from "@shared/lib/stock";
import type { StockStatus } from "@shared/types/inventory";
import { cn } from "@/lib/utils";

interface StockBadgeProps {
  stock: number;
  // The parent product's opt-in flag (Product.trackLowStock); variant rows
  // inherit it. A row with this false is never shown as low stock, however
  // small its quantity — almost every piece in this shop is a one-off sitting
  // at stock = 1, and amber-badging all of them would bury the products that
  // genuinely need restocking.
  trackLowStock: boolean;
  // Setting.lowStockThreshold, passed down from the page that already reads
  // it (CLAUDE.md rule 14).
  threshold: number;
  className?: string;
}

// Red, amber or green — the same three states, drawn the same way, as the
// POS's own StockBadge (pos/src/components/ui/stock-badge.tsx). The two share
// the decision (shared's resolveStockStatus) and the colour tokens, so a
// quantity that is amber on the selling screen is amber here.
//
// "In stock" is badged now too, where the table and the card used to show
// nothing at all. A blank cell is ambiguous — fine, or not loaded yet, or a
// row this screen has nothing to say about — and it left the two states that
// DO carry a colour looking like exceptions rather than like one scale.
//
// The colour is never the message: every state spells itself out in words and
// carries a differently shaped icon.
export function StockBadge({ stock, trackLowStock, threshold, className }: StockBadgeProps) {
  const t = useTranslations("stock");
  const status = resolveStockStatus({ stock, trackLowStock, threshold });
  const { icon: Icon, tone } = STOCK_BADGE_STYLES[status];
  const label = status === "OUT" ? t("out") : status === "LOW" ? t("low") : t("in");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tone,
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

// A 10% wash behind text at full strength, from the tokens in
// app/globals.css — no palette literals, so this and the POS cannot drift.
const STOCK_BADGE_STYLES: Readonly<Record<StockStatus, { icon: LucideIcon; tone: string }>> = {
  OUT: { icon: Ban, tone: "bg-destructive/10 text-destructive" },
  LOW: { icon: TriangleAlert, tone: "bg-warning/10 text-warning" },
  IN: { icon: CircleCheck, tone: "bg-success/10 text-success" },
};

// The bare quantity, where a row shows one next to the badge (read-only
// inventory rows). Same three tokens, no wash — the number is the badge's
// echo, not a second badge. "In stock" stays the plain foreground colour:
// tinting every ordinary figure green would leave nothing for the two states
// that need to be noticed.
export const STOCK_FIGURE_TONES: Readonly<Record<StockStatus, string>> = {
  OUT: "text-destructive",
  LOW: "text-warning",
  IN: "text-foreground",
};
