"use client";

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Button, STICKY_PRIMARY_CLASS, STICKY_SECONDARY_CLASS, StickyActions } from "@store/ui";
import type { LabelSelectBarProps } from "@/types/label";

// Selection carries across pages and filters, so the bar counts every ticked piece, not just this page's.
export function LabelSelectBar({ count, onClear, onNext }: LabelSelectBarProps) {
  const t = useTranslations("labels");

  return (
    <StickyActions
      data-testid="labels-select-bar"
      visible={count > 0}
      tone="primary"
      size="md"
      label={t("selectBar.label")}
      message={t("selectedCount", { count })}
    >
      <Button variant="quiet" className={STICKY_SECONDARY_CLASS} onClick={onClear} data-test-selector="labels-clear">
        {t("clearSelection")}
      </Button>
      <Button
        className={STICKY_PRIMARY_CLASS}
        onClick={onNext}
        data-test-selector="labels-next"
        iconPosition="end"
        icon={<ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />}
      >
        {t("next")}
      </Button>
    </StickyActions>
  );
}
