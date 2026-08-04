"use client";

import { useTranslations } from "next-intl";
import { Hash } from "lucide-react";
import { LABEL_COPIES_MAX } from "@/constants/labels";
import { parseCopies } from "@/lib/labels";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import type { LabelLine } from "@/types/label";

interface LabelCopiesListProps {
  lines: readonly LabelLine[];
  copies: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

// How many of each sticker to print. Every count is proposed, never imposed:
// stock is only a sensible starting point, and the person at the printer
// knows better (a piece is out on display, one label got ruined, ...).
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

            <div className="flex flex-col divide-y divide-border">
              {group.lines.map((line) => {
                const inputId = `copies-${line.key}`;
                return (
                  <div key={line.key} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={inputId} className="block truncate text-sm">
                        {line.subtitle ?? t("wholeProduct")}
                      </Label>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground" dir="ltr">
                        {line.code ?? t("noBarcode")}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Hash className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <NumericInput
                        id={inputId}
                        value={copies[line.key] ?? ""}
                        onChange={(e) => onChange(line.key, e.target.value)}
                        maxLength={String(LABEL_COPIES_MAX).length}
                        className="h-12 w-20 text-center"
                        dir="ltr"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
