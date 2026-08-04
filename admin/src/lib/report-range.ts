import { REPORT_PRESET_DAYS } from "@/constants/reports";
import type { ReportPresetKey, ReportRangeValue } from "@/types/report";

// Report ranges are plain local calendar dates — the same thing the phone's
// date picker produces. The backend turns them into instants using the
// offset below, so "today" always means today where the phone is.

export function timezoneOffsetMinutes(): number {
  // getTimezoneOffset() counts minutes to SUBTRACT from local time to reach
  // UTC; the API wants the opposite sign (minutes to add to UTC).
  return -new Date().getTimezoneOffset();
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Resolves a preset into concrete dates. "custom" keeps whatever dates are
// already picked — it exists precisely so the user's own choice survives.
export function rangeForPreset(preset: ReportPresetKey, current?: ReportRangeValue): ReportRangeValue {
  const today = new Date();
  const to = toLocalDateString(today);

  if (preset === "custom") {
    return { preset, from: current?.from ?? to, to: current?.to ?? to };
  }

  if (preset === "thisMonth") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { preset, from: toLocalDateString(first), to };
  }

  const daysBack = REPORT_PRESET_DAYS[preset] ?? 0;
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysBack);
  return { preset, from: toLocalDateString(from), to };
}
