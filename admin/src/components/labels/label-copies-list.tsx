"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { LABEL_COPIES_MAX } from "@/constants/labels";
import { parseCopies } from "@/lib/labels";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import type { LabelLine } from "@/types/label";

interface LabelCopiesListProps {
  lines: readonly LabelLine[];
  copies: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// Every count is proposed from stock, never imposed — the person at the printer knows better.
export function LabelCopiesList({ lines, copies, onChange }: LabelCopiesListProps) {
  const t = useTranslations("labels.copies");

  // Lines arrive grouped by product; this keeps that grouping for the headings.
  const groups: { productId: string; name: string; lines: LabelLine[] }[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && last.productId === line.productId) {
      last.lines.push(line);
    } else {
      groups.push({ productId: line.productId, name: line.name, lines: [line] });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => {
        const total = group.lines.reduce((sum, line) => sum + parseCopies(copies[line.key]), 0);

        return (
          <div key={group.productId} className="rounded-card border border-line bg-surface shadow-card">
            <div className="flex items-start justify-between gap-3 border-b border-line p-3">
              <div className="min-w-0">
                <p className="truncate text-label font-medium text-ink">{group.name}</p>
                <p className="mt-0.5 text-meta text-ink-muted">
                  {group.lines[0].isNumbered
                    ? t("numberedHint")
                    : group.lines.length > 1
                      ? t("perVariantHint", { count: group.lines.length })
                      : t("simpleHint")}
                </p>
              </div>
              <span className="shrink-0 rounded-pill bg-inset px-2 py-1 text-micro font-medium text-ink-muted">
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
  // Said on the field: proposing the cap for a larger stock would go unnoticed until labels ran out.
  const cappedStock = line.stock !== null && line.stock > LABEL_COPIES_MAX ? line.stock : null;

  return (
    <div className="flex flex-col gap-2 rounded-panel border border-line p-3">
      <div className="min-w-0">
        <p className="truncate text-label font-medium text-ink">{label}</p>
        <p className="mt-0.5 truncate text-meta text-ink-muted" dir="ltr">
          {line.code ?? t("noBarcode")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-meta text-ink-muted">{t("copiesLabel")}</span>
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

      {/* Why the count starts at zero; our own label over a supplier's code is allowed, just not proposed. */}
      {line.supplierBarcode && <p className="text-meta font-medium text-ink-muted">{t("supplierBarcode")}</p>}

      {cappedStock !== null && (
        <p className="flex items-start gap-1.5 text-meta font-medium text-warning-700">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{t("stockAboveMax", { stock: cappedStock, max: LABEL_COPIES_MAX })}</span>
        </p>
      )}
    </div>
  );
}
