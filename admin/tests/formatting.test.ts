// THE SAME DIGITS ON EVERY DEVICE.
//
// `Intl` fills in whatever the engine thinks is normal for a locale, and for
// Arabic the engines disagree: recent ICU writes `ar` in western digits, the
// ICU on the shop's iOS 15 phone writes it in Arabic-Indic ones. A price is
// read off that phone, off the counter screen and off a printed label and
// compared with a supplier's invoice, so it cannot be one number that looks
// like two.
//
// `ar-EG` stands in for that older engine here — it is a locale whose CLDR
// default really is Arabic-Indic on THIS runtime, so the test can show the
// difference rather than assert it. The first case in each block proves the
// drift is real; the rest prove the app is out of its way.
import { createTranslator } from "use-intl/core";
import { describe, expect, it } from "vitest";
import { CALENDAR, MESSAGE_FORMATS, NUMBERING_SYSTEM } from "@organza/shared/constants/formatting";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "@/lib/format";

const DRIFTING_LOCALE = "ar-EG";
const WESTERN_DIGITS = /^[^٠-٩۰-۹]*$/;

describe("the digits a device would have chosen", () => {
  it("really do differ from ours, so the rest of this file is not testing nothing", () => {
    expect(new Intl.NumberFormat(DRIFTING_LOCALE).format(1234)).not.toMatch(WESTERN_DIGITS);
  });
});

describe("Numbers", () => {
  it("writes money in the shop's digits whatever the locale would pick", () => {
    expect(formatMoney("1234.5", "ILS", DRIFTING_LOCALE)).toMatch(WESTERN_DIGITS);
  });

  it("writes a count the same way, so a figure matches the price beside it", () => {
    expect(formatNumber(1234, DRIFTING_LOCALE)).toMatch(WESTERN_DIGITS);
  });

  it("states the numbering system rather than inheriting it", () => {
    const resolved = new Intl.NumberFormat(DRIFTING_LOCALE, { numberingSystem: NUMBERING_SYSTEM }).resolvedOptions();
    expect(resolved.numberingSystem).toBe(NUMBERING_SYSTEM);
  });
});

describe("Dates", () => {
  const ISO = "2026-08-20T09:30:00.000Z";

  it("writes a date in the shop's digits", () => {
    expect(formatDate(ISO, DRIFTING_LOCALE)).toMatch(WESTERN_DIGITS);
    expect(formatDateTime(ISO, DRIFTING_LOCALE)).toMatch(WESTERN_DIGITS);
  });

  it("stays on the Gregorian calendar, which is what the paperwork uses", () => {
    // A phone set to Arabic (Saudi Arabia) dates in Umm al-Qura by default:
    // the same order would read 26 Safar there and 20 August here.
    const resolved = new Intl.DateTimeFormat("ar-SA", { calendar: CALENDAR }).resolvedOptions();
    expect(resolved.calendar).toBe(CALENDAR);
    expect(formatDate(ISO, "ar-SA")).toContain("2026");
  });

  it("renders nothing rather than 'Invalid Date' for a value it cannot read", () => {
    expect(formatDate("not a date", "ar")).toBe("");
    expect(formatDateTime(undefined, "ar")).toBe("");
  });
});

describe("Figures inside a sentence", () => {
  // A message writes `{count, number, plain}` rather than ICU's `#`, because
  // `#` is formatted with `Intl.NumberFormat(locale)` and nothing else — the
  // one path that would still take its digits from the device.
  const messages = {
    pieces: "{count, plural, other {{count, number, plain} قطعة}}",
    margin: "{value, number, percent}",
  };
  const translate = (formats?: typeof MESSAGE_FORMATS) =>
    createTranslator({ locale: DRIFTING_LOCALE, messages, formats, onError: () => {} });

  it("would drift without the shared formats", () => {
    expect(translate()("pieces", { count: 1234 })).not.toMatch(WESTERN_DIGITS);
  });

  it("does not drift with them", () => {
    const t = translate(MESSAGE_FORMATS);
    expect(t("pieces", { count: 1234 })).toMatch(WESTERN_DIGITS);
    expect(t("margin", { value: 0.125 })).toMatch(WESTERN_DIGITS);
  });
});

// The matching guard over the message FILES — "no message may reach for ICU's
// `#` again" — is shared/scripts/check-messages.js, wired into both apps'
// builds. It lives there rather than here because the POS carries most of the
// counted sentences and has no test runner of its own.
