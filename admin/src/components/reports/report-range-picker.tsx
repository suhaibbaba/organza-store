"use client";

import { useLocale, useTranslations } from "next-intl";
import { DateRangePicker, SegmentedControl } from "@store/ui";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { REPORT_PRESETS } from "@/constants/reports";
import { formatDayDate } from "@/lib/format";
import { fromLocalDateString, rangeForPreset } from "@/lib/report-range";
import { useActiveSegmentInView } from "@/lib/segmented-scroll";
import type { ReportPresetKey, ReportRangePickerProps } from "@/types/report";

// The segments scroll inside their row on a phone instead of widening the page.
export function ReportRangePicker({ value, onChange, name, presets = REPORT_PRESETS }: ReportRangePickerProps) {
  const datesName = name ? `${name}-dates` : "report-range-dates";
  const t = useTranslations("reports.range");
  const locale = useLocale();
  const rowRef = useActiveSegmentInView<HTMLDivElement>();
  const from = value.from ? formatDayDate(fromLocalDateString(value.from), locale) : "";
  const to = value.to ? formatDayDate(fromLocalDateString(value.to), locale) : "";

  function selectPreset(preset: ReportPresetKey) {
    onChange(rangeForPreset(preset, value));
  }

  return (
    <div className="flex min-w-0 flex-wrap items-start gap-3">
      <div className="flex min-w-0 max-w-full flex-col gap-2.5">
        <div ref={rowRef} className="max-w-full overflow-x-auto">
          <SegmentedControl
            data-testid={name ?? "reports-range"}
            label={t("label")}
            options={presets.map((preset) => ({ value: preset, label: t(preset) }))}
            value={value.preset}
            onChange={selectPreset}
          />
        </div>
        {/* The dates a preset stands for, so "this week" never has to be worked out; a custom range shows its own. */}
        {value.preset !== "custom" && from && (
          <p data-test-selector={`${name ?? "reports-range"}-span`} className="px-1 text-meta font-medium text-ink-muted">
            {value.from === value.to ? from : t("span", { from, to })}
          </p>
        )}
      </div>
      {value.preset === "custom" && (
        <DateRangePicker
          id={datesName}
          data-testid={fieldTestSelector(datesName)}
          label={t("dates")}
          className="w-full sm:w-72"
          value={{ from: value.from, to: value.to }}
          onChange={(range) => onChange({ preset: "custom", from: range.from, to: range.to })}
        />
      )}
    </div>
  );
}
