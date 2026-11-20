"use client";

import { useTranslations } from "next-intl";
import { ScanBarcode, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTROL_HEIGHT, SECONDARY_ACTION } from "@/components/sell/screen/control-styles";

interface TopBarActionsProps {
  onScan: () => void;
  // Absent for an account without product.quickSell: the button is not drawn.
  onQuickSell?: () => void;
}

// "Scan barcode" and "Quick sell", beside the search. Below 600px the scan
// button keeps its icon only (its name stays as the aria-label), which is how
// the design fits both beside the search on a phone.
export function TopBarActions({ onScan, onQuickSell }: TopBarActionsProps) {
  const t = useTranslations("sell");

  return (
    <>
      <button
        type="button"
        onClick={onScan}
        aria-label={t("screen.scan")}
        data-test-selector="pos-scan-open"
        className={cn(
          CONTROL_HEIGHT,
          SECONDARY_ACTION,
          "inline-flex shrink-0 items-center justify-center gap-2 px-3",
          "max-tab:w-11 max-tab:px-0"
        )}
      >
        <ScanBarcode className="size-4" aria-hidden="true" />
        <span className="hidden tab:inline">{t("screen.scan")}</span>
      </button>

      {onQuickSell && (
        <button
          type="button"
          onClick={onQuickSell}
          data-test-selector="pos-quick-sell-open"
          className={cn(
            CONTROL_HEIGHT,
            "inline-flex shrink-0 items-center justify-center gap-2 rounded-control border border-quick-border bg-quick px-3 text-sm font-medium text-quick-foreground",
            "transition-[filter] hover:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <Zap className="size-4" aria-hidden="true" />
          {t("quickSell.open")}
        </button>
      )}
    </>
  );
}
