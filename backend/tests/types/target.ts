import type { SAFE_TARGET_KINDS, TARGET_KINDS } from "@tests/constants";

export type TargetKind = (typeof TARGET_KINDS)[number];
export type SafeTargetKind = (typeof SAFE_TARGET_KINDS)[number];

export interface ResolvedTarget {
  /** The API the run will hit, with any trailing slash removed. */
  url: string;
  host: string;
  kind: TargetKind;
  /** Whether the target was chosen by the caller or defaulted to the sandbox. */
  explicit: boolean;
  /** Whether the production override was supplied, and correctly. */
  overridden: boolean;
}
