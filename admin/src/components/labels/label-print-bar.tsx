"use client";

import { useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { Button, STICKY_PRIMARY_CLASS, StickyActions } from "@store/ui";
import type { LabelPrintBarProps } from "@/types/label";

// Phones only: the side card's Print sits below a long copies list, so the bar keeps it in reach.
export function LabelPrintBar({ totalLabels, canPrint, onPrint }: LabelPrintBarProps) {
  const t = useTranslations("labels");

  return (
    <div className="lg:hidden">
      <StickyActions
        data-testid="labels-print-bar"
        visible
        tone="primary"
        size="md"
        label={t("prepare.print")}
        message={t("prepare.totalLabels", { count: totalLabels })}
      >
        <Button
          className={STICKY_PRIMARY_CLASS}
          onClick={onPrint}
          disabled={!canPrint}
          data-test-selector="labels-print-bar-print"
          icon={<Printer className="size-4" aria-hidden="true" />}
        >
          {t("prepare.print")}
        </Button>
      </StickyActions>
    </div>
  );
}
