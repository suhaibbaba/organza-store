// HOW A NUMBER AND A DATE ARE WRITTEN — decided here, once, for both apps.
//
// `Intl` takes a locale and fills in everything else from whatever the device
// thinks is normal, and "normal" is a property of the ENGINE, not of the app.
// For Arabic that is not a small difference: recent ICU resolves `ar` to
// western digits, so `Intl.NumberFormat("ar").format(250)` is "250" on this
// year's browser — and "٢٥٠" on the shop's iOS 15 phone, whose ICU predates
// that change. Dates drift the same way: a phone set to Arabic (Saudi Arabia)
// formats them in the Umm al-Qura calendar, so an order taken on 20 August
// reads as ٢٦ صفر there and 20 Aug on the counter screen, from one line of
// code.
//
// The shop reads its prices off a phone, a counter screen and a printed
// label, and compares them with each other and with a supplier's invoice. So
// the digits are stated rather than inherited.

/**
 * Western digits (0–9), everywhere, in every language.
 *
 * Not a judgement about Arabic: it is what the shop already writes. Every
 * barcode, SKU and price on a printed label is in these digits, the supplier's
 * invoices are, and the two screens have to be comparable with both at a
 * glance. A price that reads ٢٥٠ on the phone and 250 on the till is one price
 * that looks like two.
 *
 * Change this in one place if the shop ever decides otherwise — every figure
 * in both apps goes through it.
 */
export const NUMBERING_SYSTEM = "latn";

/**
 * The Gregorian calendar, stated for the same reason.
 *
 * An Arabic locale can default to an Islamic calendar depending on the region
 * the device is set to, and an order dated ٢٦ صفر cannot be matched against a
 * delivery company's paperwork, a bank statement or the date on the same order
 * in the admin.
 */
export const CALENDAR = "gregory";

/** Spread into every `Intl.NumberFormat` in both apps. */
export const NUMBER_FORMAT_BASE = { numberingSystem: NUMBERING_SYSTEM } as const;

/** Spread into every `Intl.DateTimeFormat` in both apps. */
export const DATE_FORMAT_BASE = { numberingSystem: NUMBERING_SYSTEM, calendar: CALENDAR } as const;

/**
 * The named number formats every ICU message may use, handed to `next-intl`
 * as its global `formats` (see each app's `src/i18n/request.ts`).
 *
 * A message writes a figure as `{count, number, plain}` rather than as the
 * ICU shorthand `#`, because `#` — and a bare `{count, number}` — is formatted
 * with `Intl.NumberFormat(locale)` and nothing else, which is the one path
 * that would still take its digits from the device. Naming the format sends
 * it through the base above instead, so "5 قطع" in a sentence and the price
 * underneath it are written in the same digits.
 *
 * `plain` is a count in a sentence; `percent` replaces ICU's own built-in of
 * that name, which is identical apart from the digits.
 */
export const MESSAGE_NUMBER_FORMATS = {
  plain: NUMBER_FORMAT_BASE,
  percent: { ...NUMBER_FORMAT_BASE, style: "percent" },
} as const;

/** Spread into `getRequestConfig`'s return value in admin and pos. */
export const MESSAGE_FORMATS = { number: MESSAGE_NUMBER_FORMATS } as const;
