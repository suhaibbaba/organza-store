import { parsePhoneNumberFromString } from "libphonenumber-js";
import { PALESTINE_PHONE_PREFIXES } from "../constants/phone";

// Numbers are stored exactly as entered in E.164 (CLAUDE.md rule 18) — never
// reformatted/rewritten, so WhatsApp keeps reaching the number on its real
// prefix. This only validates the format.
export function isValidE164(value: string): boolean {
  if (!value.startsWith("+")) return false;
  const parsed = parsePhoneNumberFromString(value);
  return Boolean(parsed?.isValid() && parsed.number === value);
}

// A Palestine line can be written under either +970 or +972 (CLAUDE.md rule
// 18) — returns both candidates to check for uniqueness, or the value
// unchanged if it isn't a Palestine number.
export function dualPrefixCandidates(value: string): string[] {
  const prefix = PALESTINE_PHONE_PREFIXES.find((p) => value.startsWith(p));
  if (!prefix) return [value];
  const national = value.slice(prefix.length);
  return PALESTINE_PHONE_PREFIXES.map((p) => `${p}${national}`);
}
