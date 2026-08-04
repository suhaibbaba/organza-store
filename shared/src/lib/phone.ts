import { parsePhoneNumberFromString } from "libphonenumber-js";
import { PALESTINE_PHONE_PREFIXES } from "@/constants/phone";

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

// One key per line, whichever prefix it happens to be written under: +970
// and +972 spellings of the same Palestine number are the same customer
// (CLAUDE.md rule 18), so anything grouping by number has to collapse them
// rather than list the person twice. The number itself is never rewritten —
// this is only a lookup key.
export function phoneIdentityKey(value: string): string {
  return [...dualPrefixCandidates(value)].sort()[0] ?? value;
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// Splits a stored E.164 number into its country prefix and the rest, so a
// phone field can show the two apart without rewriting either. Returns null
// for anything that isn't a recognisable number yet — a half-typed value, or
// one with no prefix at all.
export function splitE164(value: string): { prefix: string; national: string } | null {
  const known = PALESTINE_PHONE_PREFIXES.find((p) => value.startsWith(p));
  if (known) return { prefix: known, national: phoneDigits(value.slice(known.length)) };
  if (!value.startsWith("+")) return null;
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed) return null;
  return { prefix: `+${parsed.countryCallingCode}`, national: parsed.nationalNumber };
}

// The digits a customer would recite over the phone — the number without its
// country prefix. Looking a customer up by these rather than by the whole
// E.164 string is what lets a number saved under +972 still be found while
// the field in front of the cashier is sitting on +970.
export function nationalPhoneDigits(value: string): string {
  return splitE164(value)?.national ?? phoneDigits(value);
}
