"use client";

import { useTranslations } from "next-intl";
import { DateRangePicker, SegmentedControl } from "@store/ui";
import { fieldTestSelector } from "@store/shared/lib/testSelector";
import { REPORT_PRESETS } from "@/constants/reports";
import { rangeForPreset } from "@/lib/report-range";
import { useActiveSegmentInView } from "@/lib/segmented-scroll";
import type { ReportPresetKey, ReportRangePickerProps } from "@/types/report";

// The segments scroll inside their row on a phone instead of widening the page.
export function ReportRangePicker({ value, onChange }: ReportRangePickerProps) {
  const t = useTranslations("reports.range");
  const rowRef = useActiveSegmentInView<HTMLDivElement>();

  function selectPreset(preset: ReportPresetKey) {
    onChange(rangeForPreset(preset, value));
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <div ref={rowRef} className="max-w-full overflow-x-auto">
        <SegmentedControl
          data-testid="reports-range"
          label={t("label")}
          options={REPORT_PRESETS.map((preset) => ({ value: preset, label: t(preset) }))}
          value={value.preset}
          onChange={selectPreset}
        />
      </div>
      {value.preset === "custom" && (
        <DateRangePicker
          id="report-range-dates"
          data-testid={fieldTestSelector("report-range-dates")}
          label={t("dates")}
          className="w-full sm:w-72"
          value={{ from: value.from, to: value.to }}
          onChange={(range) => onChange({ preset: "custom", from: range.from, to: range.to })}
        />
      )}
    </div>
  );
}
