import { REPORT_WEEK_START_DAY } from "@store/shared/constants/report";
import { REPORT_PRESET_DAYS } from "@/constants/reports";
import type { ReportPresetKey, ReportRangeValue } from "@/types/report";

// The API wants minutes to ADD to UTC; getTimezoneOffset() counts the opposite way.
export function timezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// A plain local date (YYYY-MM-DD) back to a Date at local midnight, so the weekday is the shop's day.
export function fromLocalDateString(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// "This week" starts on the shop's week day (Saturday), the same as the backend's dashboard period.
export function weekStart(today: Date): Date {
  const back = (today.getDay() - REPORT_WEEK_START_DAY + 7) % 7;
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
}

// A preset becomes concrete local dates; "custom" keeps the dates already picked, else today.
export function rangeForPreset(preset: ReportPresetKey, current?: ReportRangeValue): ReportRangeValue {
  const today = new Date();
  const to = toLocalDateString(today);

  if (preset === "custom") {
    return { preset, from: current?.from || to, to: current?.to || to };
  }

  if (preset === "thisWeek") {
    return { preset, from: toLocalDateString(weekStart(today)), to };
  }

  if (preset === "thisMonth") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { preset, from: toLocalDateString(first), to };
  }

  const daysBack = REPORT_PRESET_DAYS[preset] ?? 0;
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysBack);
  return { preset, from: toLocalDateString(from), to };
}
