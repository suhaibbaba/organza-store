// The same digits on every device: ar-EG stands in for the iOS 15 ICU, which writes Arabic-Indic digits.
import { createTranslator } from "use-intl/core";
import { describe, expect, it } from "vitest";
import { CALENDAR, MESSAGE_FORMATS, NUMBERING_SYSTEM } from "@store/shared/constants/formatting";
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
    // Arabic (Saudi Arabia) defaults to the Umm al-Qura calendar.
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
  // Never ICU's `#`: it formats with the device's own digits.
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

// The message-file guard against `#` is shared/scripts/check-messages.js.
