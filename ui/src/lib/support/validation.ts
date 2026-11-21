// Bounds and codes the date controls share with whatever validates them.
export const VALIDATION_CODE = {
  YEAR_OUT_OF_RANGE: "year_out_of_range",
  DATE_IN_FUTURE: "date_in_future",
  DATE_IN_PAST: "date_in_past",
} as const;

export const EARLIEST_YEAR = 1900;

export const LATEST_YEAR = 2100;
