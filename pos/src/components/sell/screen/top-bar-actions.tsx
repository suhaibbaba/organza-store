"use client";

import { useTranslations } from "next-intl";
import { ScanBarcode, Zap } from "lucide-react";
import { Button } from "@store/ui";
import { cn } from "@/lib/utils";
import { CONTROL_HEIGHT } from "@/components/sell/screen/control-styles";

interface TopBarActionsProps {
  onScan: () => void;
  // Absent for an account without product.quickSell: the button is not drawn.
  onQuickSell?: () => void;
}

// Below 600px the scan button keeps its icon only (its name stays as the aria-label).
export function TopBarActions({ onScan, onQuickSell }: TopBarActionsProps) {
  const t = useTranslations("sell");

  return (
    <>
      <Button
        variant="secondary"
        onClick={onScan}
        aria-label={t("screen.scan")}
        data-test-selector="pos-scan-open"
        icon={<ScanBarcode className="size-4" aria-hidden="true" />}
        className={cn(CONTROL_HEIGHT, "shrink-0 px-3", "max-tab:w-11 max-tab:px-0")}
      >
        <span className="hidden tab:inline">{t("screen.scan")}</span>
      </Button>

      {onQuickSell && (
        <Button
          variant="secondary"
          onClick={onQuickSell}
          data-test-selector="pos-quick-sell-open"
          icon={<Zap className="size-4" aria-hidden="true" />}
          className={cn(
            CONTROL_HEIGHT,
            "shrink-0 border-warning-300 bg-warning-50 px-3 text-warning-800",
            "hover:border-warning-500 hover:bg-warning-100 hover:text-warning-800"
          )}
        >
          {t("quickSell.open")}
        </Button>
      )}
    </>
  );
}
