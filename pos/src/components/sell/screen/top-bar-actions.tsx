"use client";

import { useTranslations } from "next-intl";
import { ScanBarcode, Zap } from "lucide-react";
import { Button } from "@store/ui";
import { cn } from "@/lib/utils";

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
        className={cn("shrink-0 px-3", "max-tab:w-11 max-tab:px-0")}
      >
        <span className="hidden tab:inline">{t("screen.scan")}</span>
      </Button>

      {onQuickSell && (
        <Button
          variant="secondary"
          onClick={onQuickSell}
          data-test-selector="pos-quick-sell-open"
          icon={<Zap className="size-4 text-warning-700" aria-hidden="true" />}
          className={"shrink-0 px-3"}
        >
          {t("quickSell.open")}
        </Button>
      )}
    </>
  );
}
