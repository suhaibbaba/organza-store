"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REPORT_PRESETS } from "@/constants/reports";
import { rangeForPreset } from "@/lib/report-range";
import { cn } from "@/lib/utils";
import type { ReportPresetKey, ReportRangeValue } from "@/types/report";

interface ReportRangePickerProps {
  value: ReportRangeValue;
  onChange: (value: ReportRangeValue) => void;
}

// One row of big tappable chips for the ranges people actually ask for, with
// two date fields appearing only when they pick their own. No calendar
// library and no wizard: the common case is a single tap.
//
// It sits in the page header, so it is sized to its own chips (w-fit) rather
// than stretched across the row — and bounded by the header (max-w-full), so
// on a phone the chips scroll inside it instead of widening the page.
export function ReportRangePicker({ value, onChange }: ReportRangePickerProps) {
  const t = useTranslations("reports.range");

  function selectPreset(preset: ReportPresetKey) {
    onChange(rangeForPreset(preset, value));
  }

  return (
    <div className="inline-flex w-fit min-w-0 max-w-full flex-col gap-3">
      {/* Scrolls sideways on a narrow phone instead of wrapping into a block
          of chips that pushes the figures off screen. */}
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
        {REPORT_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={value.preset === preset}
            onClick={() => selectPreset(preset)}
            className={cn(
              "h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors",
              value.preset === preset
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground active:bg-accent"
            )}
          >
            {t(preset)}
          </button>
        ))}
      </div>

      {value.preset === "custom" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Native date inputs get the phone's own date picker — nothing to
              learn, nothing to type in the wrong format. dir="ltr" keeps the
              y/m/d segments in their expected order inside an RTL page. */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-range-from">{t("from")}</Label>
            <Input
              id="report-range-from"
              type="date"
              dir="ltr"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="report-range-to">{t("to")}</Label>
            <Input
              id="report-range-to"
              type="date"
              dir="ltr"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
