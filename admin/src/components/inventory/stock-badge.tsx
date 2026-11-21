import { useTranslations } from "next-intl";
import { Ban, CircleCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { resolveStockStatus } from "@store/shared/lib/stock";
import type { StockStatus } from "@store/shared/types/inventory";
import { cn } from "@/lib/utils";

interface StockBadgeProps {
  stock: number;
  // Product.trackLowStock: one-off pieces at stock 1 are never badged low unless the product opts in.
  trackLowStock: boolean;
  // Setting.lowStockThreshold (rule 14).
  threshold: number;
  className?: string;
}

// Same three states and decision (shared resolveStockStatus) as the POS badge; colour is never the only signal.
export function StockBadge({ stock, trackLowStock, threshold, className }: StockBadgeProps) {
  const t = useTranslations("stock");
  const status = resolveStockStatus({ stock, trackLowStock, threshold });
  const { icon: Icon, tone } = STOCK_BADGE_STYLES[status];
  const label = status === "OUT" ? t("out") : status === "LOW" ? t("low") : t("in");

  return (
    <span
      className={cn(
        "pill-text inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-meta font-medium",
        tone,
        className
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}

const STOCK_BADGE_STYLES: Readonly<Record<StockStatus, { icon: LucideIcon; tone: string }>> = {
  OUT: { icon: Ban, tone: "bg-danger-50 text-danger-600" },
  LOW: { icon: TriangleAlert, tone: "bg-warning-50 text-warning-700" },
  IN: { icon: CircleCheck, tone: "bg-success-50 text-success-700" },
};

// The bare quantity beside the badge; "in stock" stays plain ink so the two alarming states stand out.
export const STOCK_FIGURE_TONES: Readonly<Record<StockStatus, string>> = {
  OUT: "text-danger-600",
  LOW: "text-warning-700",
  IN: "text-ink",
};
