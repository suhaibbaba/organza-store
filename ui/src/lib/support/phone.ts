export const PHONE_COUNTRIES = [
  { country: "PS", dial: "+970" },
  { country: "IL", dial: "+972" },
  { country: "JO", dial: "+962" },
  { country: "EG", dial: "+20" },
  { country: "SA", dial: "+966" },
  { country: "AE", dial: "+971" },
  { country: "QA", dial: "+974" },
  { country: "KW", dial: "+965" },
  { country: "BH", dial: "+973" },
  { country: "OM", dial: "+968" },
  { country: "LB", dial: "+961" },
  { country: "SY", dial: "+963" },
  { country: "IQ", dial: "+964" },
  { country: "TR", dial: "+90" },
  { country: "GB", dial: "+44" },
  { country: "DE", dial: "+49" },
  { country: "US", dial: "+1" },
] as const;

export type PhoneCountry = (typeof PHONE_COUNTRIES)[number]["country"];

export const PHONE_COUNTRY_CODES = PHONE_COUNTRIES.map((entry) => entry.country) as [
  PhoneCountry,
  ...PhoneCountry[],
];

export const DEFAULT_PHONE_COUNTRY: PhoneCountry = "PS";

export const isPhoneCountry = (value: string | null | undefined): value is PhoneCountry =>
  PHONE_COUNTRIES.some((entry) => entry.country === value);

export const dialCodeOf = (country: PhoneCountry): string =>
  PHONE_COUNTRIES.find((entry) => entry.country === country)?.dial ?? "+970";

const BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

const digitsOf = (value: string): string => value.replace(/\D/g, "");

const nationalNumber = (local: string): string => digitsOf(local).replace(/^0/, "");

export function joinPhone(country: PhoneCountry, local: string): string | null {
  const trimmed = local.trim();

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    return normalizePhone(trimmed);
  }

  const national = nationalNumber(trimmed);

  return national === "" ? null : `${dialCodeOf(country)}${national}`;
}

export function normalizePhone(
  value: string,
  country: PhoneCountry = DEFAULT_PHONE_COUNTRY,
): string {
  const trimmed = value.trim();

  if (!trimmed.startsWith("+") && !trimmed.startsWith("00")) {
    return `${dialCodeOf(country)}${nationalNumber(trimmed)}`;
  }

  const international = `+${digitsOf(trimmed).replace(/^00/, "")}`;
  const known = BY_DIAL_LENGTH.find((entry) => international.startsWith(entry.dial));

  return known
    ? `${known.dial}${international.slice(known.dial.length).replace(/^0/, "")}`
    : international;
}

export function splitPhone(
  value: string | null | undefined,
  fallback: PhoneCountry = DEFAULT_PHONE_COUNTRY,
): { readonly country: PhoneCountry; readonly local: string } {
  if (!value) {
    return { country: fallback, local: "" };
  }

  const known = BY_DIAL_LENGTH.find((entry) => value.startsWith(entry.dial));

  return known
    ? { country: known.country, local: value.slice(known.dial.length) }
    : { country: fallback, local: value };
}

export const PHONE_DIAL_DIGITS = BY_DIAL_LENGTH.map((entry) => entry.dial.slice(1));

export function nationalPhoneDigits(phone: string): string {
  const trimmed = phone.trim();

  if (!trimmed.startsWith("+") && !trimmed.startsWith("00")) {
    return nationalNumber(trimmed);
  }

  const digits = digitsOf(trimmed).replace(/^00/, "");
  const dial = PHONE_DIAL_DIGITS.find((code) => digits.startsWith(code));

  return dial ? digits.slice(dial.length).replace(/^0/, "") : digits;
}

export const INTERNATIONAL_PHONE_PATTERN = /^\+\d{7,15}$/;

const SHARED_NUMBERING_DIALS = ["970", "972"] as const;

export function phoneDigitVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "").replace(/^00/, "");
  const dial = SHARED_NUMBERING_DIALS.find((code) => digits.startsWith(code));

  return dial
    ? SHARED_NUMBERING_DIALS.map((code) => `${code}${digits.slice(dial.length)}`)
    : [digits];
}

export const canonicalPhoneDigits = (phone: string): string => phoneDigitVariants(phone)[0] ?? "";

export const isSamePhone = (a: string, b: string): boolean =>
  canonicalPhoneDigits(a) === canonicalPhoneDigits(b);

const MOBILE_NATIONAL_PATTERNS: Readonly<Record<string, RegExp>> = {
  "+970": /^5\d{8}$/,
  "+972": /^5\d{8}$/,
  "+962": /^7[789]\d{7}$/,
  "+20": /^1[0125]\d{8}$/,
  "+966": /^5\d{8}$/,
  "+971": /^5\d{8}$/,
  "+90": /^5\d{9}$/,
  "+974": /^[3567]\d{7}$/,
  "+965": /^[569]\d{7}$/,
  "+973": /^3\d{7}$/,
  "+968": /^[79]\d{7}$/,
  "+961": /^(3\d{6}|7[01689]\d{6}|81\d{6})$/,
  "+963": /^9\d{8}$/,
  "+964": /^7\d{9}$/,
  "+44": /^7\d{9}$/,
  "+49": /^1[5-7]\d{8,9}$/,
  "+1": /^[2-9]\d{2}[2-9]\d{6}$/,
};

export function isMobilePhone(phone: string): boolean {
  if (!INTERNATIONAL_PHONE_PATTERN.test(phone)) {
    return false;
  }

  const known = BY_DIAL_LENGTH.find((entry) => phone.startsWith(entry.dial));
  const pattern = known ? MOBILE_NATIONAL_PATTERNS[known.dial] : undefined;

  return pattern ? pattern.test(phone.slice(known?.dial.length ?? 0)) : true;
}
