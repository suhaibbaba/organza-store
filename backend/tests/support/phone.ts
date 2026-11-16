import { PALESTINE_PHONE_PREFIXES } from "@/constants";
import { TEST_LOCAL_NUMBER_DIGITS, TEST_MOBILE_PREFIX } from "@tests/constants";

// A random N-digit local number after the mobile prefix mirrors the shape
// the seed uses (e.g. "+970599000001"), which libphonenumber-js validates
// as a real Palestinian mobile range.
function randomLocalNumber(): string {
  const min = 10 ** (TEST_LOCAL_NUMBER_DIGITS - 1);
  const max = 10 ** TEST_LOCAL_NUMBER_DIGITS;
  return String(Math.floor(min + Math.random() * (max - min)));
}

export function randomPalestinePhone(prefix: (typeof PALESTINE_PHONE_PREFIXES)[number] = PALESTINE_PHONE_PREFIXES[0]): string {
  return `${prefix}${TEST_MOBILE_PREFIX}${randomLocalNumber()}`;
}

export function samePhoneUnderOtherPrefix(phone: string): string {
  const prefix = PALESTINE_PHONE_PREFIXES.find((p) => phone.startsWith(p));
  if (!prefix) throw new Error(`${phone} does not start with a known Palestine prefix`);
  const other = PALESTINE_PHONE_PREFIXES.find((p) => p !== prefix)!;
  return `${other}${phone.slice(prefix.length)}`;
}
