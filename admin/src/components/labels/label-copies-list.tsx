"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { LABEL_COPIES_MAX } from "@/constants/labels";
import { parseCopies } from "@/lib/labels";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import type { LabelLine } from "@/types/label";

interface LabelCopiesListProps {
  lines: readonly LabelLine[];
  copies: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// How many of each sticker to print. Every count is proposed, never imposed:
// stock is only a sensible starting point, and the person at the printer
// knows better (a piece is out on display, one label got ruined, ...).
//
// A design and its count belong together, so each is a cell of its own — name,
// code and stepper stacked inside one bordered box — rather than a full-width
// row with the field pushed to the far edge. On a phone that is the single
// column it always was; a desk or the counter's touch monitor fits two or
// three across, which is the difference between scrolling through a
// twelve-size product and seeing it.
export function LabelCopiesList({ lines, copies, onChange }: LabelCopiesListProps) {
  const t = useTranslations("labels.copies");

  // Lines arrive grouped by product already (one product's lines are built
  // together); this keeps that grouping for the headings.
  const groups: { productId: string; name: string; lines: LabelLine[] }[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.productId === line.productId) last.lines.push(line);
    else groups.push({ productId: line.productId, name: line.name, lines: [line] });
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const total = group.lines.reduce((sum, line) => sum + parseCopies(copies[line.key]), 0);

        return (
          <div key={group.productId} className="rounded-xl border border-border bg-card">
            <div className="flex items-start justify-between gap-3 border-b border-border p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{group.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {group.lines[0].isNumbered
                    ? t("numberedHint")
                    : group.lines.length > 1
                      ? t("perVariantHint", { count: group.lines.length })
                      : t("simpleHint")}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                {t("total", { count: total })}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.lines.map((line) => (
                <CopiesCell key={line.key} line={line} value={copies[line.key] ?? ""} onChange={onChange} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CopiesCell({
  line,
  value,
  onChange,
}: {
  line: LabelLine;
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  const t = useTranslations("labels.copies");

  const label = line.subtitle ?? t("wholeProduct");
  // The one case where the proposal is smaller than the shop's own count.
  // Said on the field, not swallowed: printing 999 stickers for 1200 pieces
  // is a mistake nobody would notice until they ran out of labels.
  const cappedStock = line.stock !== null && line.stock > LABEL_COPIES_MAX ? line.stock : null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">
          {line.code ?? t("noBarcode")}
        </p>
      </div>

      {/* Label beside its control, not pushed to the far edge of the card:
          "Copies" and the number it names have to read as one thing. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-xs text-muted-foreground">{t("copiesLabel")}</span>
        <QuantityStepper
          value={parseCopies(value)}
          max={LABEL_COPIES_MAX}
          onChange={(copies) => onChange(line.key, String(copies))}
          decreaseLabel={t("decrease", { name: label })}
          increaseLabel={t("increase", { name: label })}
          valueLabel={t("copiesFor", { name: label })}
          className="shrink-0"
        />
      </div>

      {/* Says why the count starts at zero. The field is still live — printing
          our own label over a supplier's code is allowed, just not proposed. */}
      {line.supplierBarcode && (
        <p className="text-xs font-medium text-muted-foreground">{t("supplierBarcode")}</p>
      )}

      {cappedStock !== null && (
        <p className="flex items-start gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{t("stockAboveMax", { stock: cappedStock, max: LABEL_COPIES_MAX })}</span>
        </p>
      )}
    </div>
  );
}
