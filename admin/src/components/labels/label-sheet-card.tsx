"use client";

import { useTranslations } from "next-intl";
import { Printer, StickyNote } from "lucide-react";
import { Button, Typography } from "@store/ui";
import { can } from "@store/shared/lib/permissions";
import { Link } from "@/i18n/navigation";
import { DetailCard } from "@/components/layout/detail-card";
import { useSession } from "@/components/providers/session-provider";
import type { LabelSheetCardProps } from "@/types/label";

// The sheet comes from Settings (rule 14); this card only names it, and Print lives here on desktop.
export function LabelSheetCard({ geometry, totalLabels, canPrint, onPrint, children }: LabelSheetCardProps) {
  const t = useTranslations("labels");
  const { user } = useSession();

  return (
    <DetailCard icon={StickyNote} title={t("sheet.title")} data-testid="label-sheet-summary">
      <div className="flex flex-col gap-1">
        <Typography variant="body" as="p">
          {geometry.printMode === "A4_GRID"
            ? t("sheet.a4", {
                width: geometry.widthMm,
                height: geometry.heightMm,
                columns: geometry.columns,
                rows: geometry.rows,
              })
            : t("sheet.thermal", { width: geometry.widthMm, height: geometry.heightMm })}
        </Typography>
        {can(user, "settings.manage") && (
          <Link
            href="/settings"
            data-test-selector="label-sheet-change"
            className="self-start rounded-control text-label font-medium text-primary-700 transition-colors hover:text-primary-900 focus-link"
          >
            {t("sheet.change")}
          </Link>
        )}
      </div>

      {children}

      <div className="hidden flex-col gap-3 border-t border-line pt-4 lg:flex">
        <div className="flex items-baseline justify-between gap-3">
          <Typography variant="body" tone="muted" as="span">
            {t("prepare.labelsToPrint")}
          </Typography>
          <Typography variant="h2" as="span" weight="bold" className="tabular-nums" data-test-selector="label-total">
            {totalLabels}
          </Typography>
        </div>
        <Button
          onClick={onPrint}
          disabled={!canPrint}
          data-test-selector="label-print"
          icon={<Printer className="size-4" aria-hidden="true" />}
          className="self-start"
        >
          {t("prepare.print")}
        </Button>
      </div>
    </DetailCard>
  );
}
