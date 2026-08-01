import { PALESTINE_PHONE_PREFIXES } from "@/constants";

// A 6-digit local number after the "599" mobile prefix mirrors the shape the
// seed uses (e.g. "+970599000001"), which libphonenumber-js validates as a
// real Palestinian mobile range.
function sixDigits(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

export function randomPalestinePhone(prefix: (typeof PALESTINE_PHONE_PREFIXES)[number] = PALESTINE_PHONE_PREFIXES[0]): string {
  return `${prefix}599${sixDigits()}`;
}

export function samePhoneUnderOtherPrefix(phone: string): string {
  const prefix = PALESTINE_PHONE_PREFIXES.find((p) => phone.startsWith(p));
  if (!prefix) throw new Error(`${phone} does not start with a known Palestine prefix`);
  const other = PALESTINE_PHONE_PREFIXES.find((p) => p !== prefix)!;
  return `${other}${phone.slice(prefix.length)}`;
}
