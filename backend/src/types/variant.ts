import type { I18n } from "./common";

// A resolved global option value (e.g. Color -> "Red"), looked up by id while
// generating/validating variant combinations.
export interface OptionValueLookup {
  id: string;
  value: I18n;
}
