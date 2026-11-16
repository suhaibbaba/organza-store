// Time arithmetic used by reporting (period boundaries, range lengths).
// Kept here rather than inline so no file re-derives 86_400_000 by hand.
export const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
