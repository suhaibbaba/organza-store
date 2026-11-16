import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { toLatinDigits } from './search.js';

/**
 * Ported from the old system. A Palestinian line can be written under +970 or +972. Numbers are
 * stored exactly as entered (E.164) so WhatsApp keeps reaching the real prefix; uniqueness uses
 * an identity key that collapses both spellings.
 */
export const PALESTINE_PHONE_PREFIXES = ['+970', '+972'] as const;

/** Turns what a person typed into E.164, using the shop's default prefix for local numbers. */
export function toE164(input: string, defaultPrefix = '+970'): string | null {
  const raw = toLatinDigits(input).replace(/[\s\-().]/g, '');
  if (!raw) return null;
  let candidate = raw;
  if (candidate.startsWith('00')) candidate = `+${candidate.slice(2)}`;
  else if (!candidate.startsWith('+')) candidate = `${defaultPrefix}${candidate.replace(/^0/, '')}`;
  if (!/^\+\d{6,15}$/.test(candidate)) return null;
  if (PALESTINE_PHONE_PREFIXES.some((p) => candidate.startsWith(p))) {
    // Both prefixes reach the same mobile lines; validate against the Israeli plan, which
    // libphonenumber knows for both.
    const national = candidate.slice(4);
    return /^5\d{8}$/.test(national) || /^[2-9]\d{7}$/.test(national) ? candidate : null;
  }
  const parsed = parsePhoneNumberFromString(candidate);
  return parsed?.isValid() ? parsed.number : null;
}

export function isValidE164(value: string): boolean {
  return toE164(value) === value;
}

/** Both spellings of a Palestinian number, or the number itself. */
export function dualPrefixCandidates(value: string): string[] {
  const prefix = PALESTINE_PHONE_PREFIXES.find((p) => value.startsWith(p));
  if (!prefix) return [value];
  const national = value.slice(prefix.length);
  return PALESTINE_PHONE_PREFIXES.map((p) => `${p}${national}`);
}

/** One key per line whichever prefix it is written under (lookup key only). */
export function phoneIdentityKey(value: string): string {
  return [...dualPrefixCandidates(value)].sort()[0] ?? value;
}

/** The digits a customer would recite: the number without its country prefix. */
export function nationalPhoneDigits(value: string): string {
  const known = PALESTINE_PHONE_PREFIXES.find((p) => value.startsWith(p));
  if (known) return value.slice(known.length);
  const parsed = parsePhoneNumberFromString(value);
  return parsed?.nationalNumber ?? value.replace(/\D/g, '');
}
