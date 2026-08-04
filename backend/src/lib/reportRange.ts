import {
  MS_PER_MINUTE,
  REPORT_DAILY_MAX_DAYS,
  REPORT_WEEKLY_MAX_DAYS,
  REPORT_WEEK_START_DAY,
} from "@/constants";
import type { ReportGranularity, ReportPeriod, ReportRange } from "@/types";

// Turning "today" into instants.
//
// A report is read in the viewer's local time (their phone's), not the
// server's: the shop closes at night local time, so a sale at 23:30 belongs
// to that day and not to the next UTC one. The client sends its offset in
// minutes to add to UTC; every boundary below is computed on a shifted clock
// and shifted back, so no server timezone ever leaks into the numbers.

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

// The dashboard's three quick periods, all ending "now": today since local
// midnight, this week since REPORT_WEEK_START_DAY (Saturday — the store is in
// Palestine), this month since the 1st.
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

// A picked range: two local calendar dates (YYYY-MM-DD), inclusive of both.
// `to` becomes local midnight of the following day so the last day counts in
// full — a half-open window is also what the SQL below compares against.
export function pickedRange(from: string, to: string, tzOffset: number): ReportRange {
  const fromInstant = shift(new Date(`${from}T00:00:00.000Z`), -tzOffset);
  const toInstant = addLocalDays(shift(new Date(`${to}T00:00:00.000Z`), -tzOffset), 1, tzOffset);
  return { from: fromInstant, to: toInstant };
}

// How wide the chart's buckets should be. A phone can read two months of
// daily bars but not a year of them, so longer ranges group up.
export function granularityFor(range: ReportRange): ReportGranularity {
  const days = (range.to.getTime() - range.from.getTime()) / (24 * 60 * MS_PER_MINUTE);
  if (days <= REPORT_DAILY_MAX_DAYS) return "day";
  if (days <= REPORT_WEEKLY_MAX_DAYS) return "week";
  return "month";
}
