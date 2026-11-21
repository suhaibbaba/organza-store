import { parsePhoneNumberFromString } from "libphonenumber-js";
import { PALESTINE_PHONE_PREFIXES } from "@/constants/phone";

// E.164 stored exactly as entered, never rewritten, so WhatsApp reaches the real prefix (rule 18); this validates format only.
export function isValidE164(value: string): boolean {
  if (!value.startsWith("+")) {
    return false;
  }
  const parsed = parsePhoneNumberFromString(value);
  return Boolean(parsed?.isValid() && parsed.number === value);
}

// A Palestine number under both +970 and +972, for the uniqueness check (rule 18); other numbers unchanged.
export function dualPrefixCandidates(value: string): string[] {
  const prefix = PALESTINE_PHONE_PREFIXES.find((p) => value.startsWith(p));
  if (!prefix) {
    return [value];
  }
  const national = value.slice(prefix.length);
  return PALESTINE_PHONE_PREFIXES.map((p) => `${p}${national}`);
}

// One grouping key for both Palestine prefixes of a number; the number itself is never rewritten.
export function phoneIdentityKey(value: string): string {
  return [...dualPrefixCandidates(value)].sort()[0] ?? value;
}

export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

// Splits stored E.164 into prefix and rest without rewriting either; null while half-typed or prefixless.
export function splitE164(value: string): { prefix: string; national: string } | null {
  const known = PALESTINE_PHONE_PREFIXES.find((p) => value.startsWith(p));
  if (known) {
    return { prefix: known, national: phoneDigits(value.slice(known.length)) };
  }
  if (!value.startsWith("+")) {
    return null;
  }
  const parsed = parsePhoneNumberFromString(value);
  if (!parsed) {
    return null;
  }
  return { prefix: `+${parsed.countryCallingCode}`, national: parsed.nationalNumber };
}

// The number without its country prefix, so a +972 number is found while the field sits on +970.
export function nationalPhoneDigits(value: string): string {
  return splitE164(value)?.national ?? phoneDigits(value);
}
