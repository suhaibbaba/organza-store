"use client";

import { useTranslations } from "next-intl";
import { FormField, Input } from "@store/ui";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { REPORT_PRESETS } from "@/constants/reports";
import { rangeForPreset } from "@/lib/report-range";
import { useActiveSegmentInView } from "@/lib/segmented-scroll";
import { cn } from "@/lib/utils";
import type { ReportPresetKey, ReportRangeValue } from "@/types/report";

interface ReportRangePickerProps {
  value: ReportRangeValue;
  onChange: (value: ReportRangeValue) => void;
}

// Sized to its chips and bounded by the header, so on a phone the chips scroll inside it instead of widening the page.
export function ReportRangePicker({ value, onChange }: ReportRangePickerProps) {
  const t = useTranslations("reports.range");
  const chipsRef = useActiveSegmentInView<HTMLDivElement>();

  function selectPreset(preset: ReportPresetKey) {
    onChange(rangeForPreset(preset, value));
  }

  return (
    <div className="inline-flex w-fit min-w-0 max-w-full flex-col gap-3">
      <div ref={chipsRef} className="flex max-w-full gap-2 overflow-x-auto pb-1">
        {REPORT_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            aria-pressed={value.preset === preset}
            onClick={() => selectPreset(preset)}
            className={cn(
              "h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-pill border-[1.5px] px-4 text-label font-medium transition-colors",
              value.preset === preset
                ? "border-primary-600 bg-primary-600 text-ink-inverse focus-visible:border-primary-800 focus-visible:bg-primary-800"
                : "border-line-strong bg-surface text-ink-muted hover:bg-inset hover:text-ink focus-visible:bg-neutral-200 focus-visible:text-ink active:bg-inset"
            )}
          >
            {t(preset)}
          </button>
        ))}
      </div>

      {value.preset === "custom" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Native date inputs get the phone's own picker; dir="ltr" keeps y/m/d in order inside RTL. */}
          <FormField label="reports.range.from" htmlFor="report-range-from">
            <Input
              id="report-range-from"
              data-testid={fieldTestSelector("report-range-from")}
              type="date"
              dir="ltr"
              value={value.from}
              max={value.to || undefined}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
          </FormField>
          <FormField label="reports.range.to" htmlFor="report-range-to">
            <Input
              id="report-range-to"
              data-testid={fieldTestSelector("report-range-to")}
              type="date"
              dir="ltr"
              value={value.to}
              min={value.from || undefined}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </FormField>
        </div>
      )}
    </div>
  );
}
