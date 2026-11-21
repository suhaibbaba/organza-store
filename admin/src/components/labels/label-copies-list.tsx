"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Badge, Typography } from "@store/ui";
import { testSelectorFor } from "@store/shared/lib/testSelector";
import { LABEL_COPIES_MAX } from "@/constants/labels";
import { parseCopies } from "@/lib/labels";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { ProductImage } from "@/components/products/product-image";
import type { LabelCopiesListProps, LabelCopiesRowProps, LabelLine } from "@/types/label";

const THUMB_SIZES = "48px";

// Every count is proposed from stock, never imposed: the person at the printer knows better.
export function LabelCopiesList({ lines, copies, onChange }: LabelCopiesListProps) {
  const t = useTranslations("labels.copies");

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
    <ul
      className="flex flex-col divide-y divide-line overflow-hidden rounded-card border border-line bg-surface"
      data-test-selector="label-copies"
    >
      {groups.map((group) => {
        const total = group.lines.reduce((sum, line) => sum + parseCopies(copies[line.key]), 0);
        const isGroup = group.lines.length > 1;

        return (
          <li key={group.productId} data-test-selector={testSelectorFor("label-copies-group", group.productId)}>
            {isGroup && (
              <div className="flex items-start justify-between gap-3 bg-sunken px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Typography variant="body" weight="medium" as="span">
                    {group.name}
                  </Typography>
                  <Typography variant="small" tone="muted" as="span">
                    {t("perVariantHint", { count: group.lines.length })}
                  </Typography>
                </div>
                <Badge tone="neutral" className="shrink-0 whitespace-nowrap tabular-nums">
                  {t("total", { count: total })}
                </Badge>
              </div>
            )}
            <ul className="flex flex-col divide-y divide-line">
              {group.lines.map((line) => (
                <CopiesRow key={line.key} line={line} value={copies[line.key] ?? ""} onChange={onChange} />
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

function CopiesRow({ line, value, onChange }: LabelCopiesRowProps) {
  const t = useTranslations("labels.copies");

  const title = line.subtitle ?? line.name;
  // A single line names the product, so it also carries the hint a group shows in its heading.
  const hint = line.subtitle ? null : line.isNumbered ? t("numberedHint") : t("simpleHint");
  // Said on the field: proposing the cap for a larger stock would go unnoticed until labels ran out.
  const cappedStock = line.stock !== null && line.stock > LABEL_COPIES_MAX ? line.stock : null;

  return (
    <li
      className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3"
      data-test-selector={testSelectorFor("label-copies-row", line.key)}
    >
      <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
        <ProductImage src={line.thumbnailUrl} alt="" className="size-12 shrink-0 rounded-control" sizes={THUMB_SIZES} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Typography variant="body" weight="medium" as="span">
            {title}
          </Typography>
          <Typography variant="small" tone="muted" as="span" dir="ltr" className="self-start tabular-nums">
            {line.code ?? t("noBarcode")}
          </Typography>
          {hint && (
            <Typography variant="small" tone="muted" as="span">
              {hint}
            </Typography>
          )}
          {/* Why the count starts at zero: our own label over a supplier's code is allowed, just not proposed. */}
          {line.supplierBarcode && (
            <Typography variant="small" tone="muted" as="span">
              {t("supplierBarcode")}
            </Typography>
          )}
          {cappedStock !== null && (
            <Typography variant="small" as="span" className="flex items-start gap-1.5 text-warning-700">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>{t("stockAboveMax", { stock: cappedStock, max: LABEL_COPIES_MAX })}</span>
            </Typography>
          )}
        </div>
      </div>

      <QuantityStepper
        value={parseCopies(value)}
        max={LABEL_COPIES_MAX}
        onChange={(copies) => onChange(line.key, String(copies))}
        decreaseLabel={t("decrease", { name: title })}
        increaseLabel={t("increase", { name: title })}
        valueLabel={t("copiesFor", { name: title })}
        className="ms-auto shrink-0"
      />
    </li>
  );
}
