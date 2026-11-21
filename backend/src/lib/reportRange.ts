import { MS_PER_MINUTE, REPORT_WEEK_START_DAY } from "@/constants";
import type { ReportPeriod, ReportRange } from "@/types";

// Boundaries are computed on the viewer's shifted clock and shifted back, so a 23:30 sale stays on its local day.

function shift(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

// Local midnight opening the day `date` falls in, as a real instant.
function startOfLocalDay(date: Date, tzOffset: number): Date {
  const local = shift(date, tzOffset);
  local.setUTCHours(0, 0, 0, 0);
  return shift(local, -tzOffset);
}

function addLocalDays(date: Date, days: number, tzOffset: number): Date {
  const local = shift(date, tzOffset);
  local.setUTCDate(local.getUTCDate() + days);
  return shift(local, -tzOffset);
}

// The dashboard's periods, all ending now: today, this week (from REPORT_WEEK_START_DAY), this month.
export function periodRange(period: ReportPeriod, tzOffset: number, now: Date = new Date()): ReportRange {
  const to = now;

  if (period === "today") {
    return { from: startOfLocalDay(now, tzOffset), to };
  }

  if (period === "week") {
    const local = shift(now, tzOffset);
    // Days elapsed since the most recent week start (0 when today is it).
    const daysIntoWeek = (local.getUTCDay() - REPORT_WEEK_START_DAY + 7) % 7;
    return { from: addLocalDays(startOfLocalDay(now, tzOffset), -daysIntoWeek, tzOffset), to };
  }

  const local = shift(now, tzOffset);
  local.setUTCDate(1);
  local.setUTCHours(0, 0, 0, 0);
  return { from: shift(local, -tzOffset), to };
}

// Two local dates, both inclusive: `to` becomes the next local midnight, the half-open window the SQL compares against.
export function pickedRange(from: string, to: string, tzOffset: number): ReportRange {
  const fromInstant = shift(new Date(`${from}T00:00:00.000Z`), -tzOffset);
  const toInstant = addLocalDays(shift(new Date(`${to}T00:00:00.000Z`), -tzOffset), 1, tzOffset);
  return { from: fromInstant, to: toInstant };
}

// The last `days` local days ending now, today included.
export function lastDaysRange(days: number, tzOffset: number, now: Date = new Date()): ReportRange {
  return { from: addLocalDays(startOfLocalDay(now, tzOffset), -(days - 1), tzOffset), to: now };
}

// Each local date in a range, oldest first, as YYYY-MM-DD.
export function localDatesIn(range: ReportRange, tzOffset: number): string[] {
  const dates: string[] = [];
  for (let day = range.from; day < range.to; day = addLocalDays(day, 1, tzOffset)) {
    dates.push(shift(day, tzOffset).toISOString().slice(0, 10));
  }
  return dates;
}
