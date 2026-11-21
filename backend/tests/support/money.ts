// Money assertions name the figure ("expected 162.00, got 161.99") and compare scaled integers, so they add no float drift.
import { expect } from "vitest";
import { MONEY_DECIMAL_PLACES, MONEY_SCALE, MONEY_STRING_PATTERN } from "@tests/constants";

export type MoneyLike = string | number | null | undefined;

/** The scaled integer an amount really is: "162.00" -> 16200. */
export function agorot(value: MoneyLike): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Not an amount: ${JSON.stringify(value)}`);
  }
  return Math.round(numeric * MONEY_SCALE);
}

/** The canonical 2dp form of an amount, for messages and for comparison. */
export function money(value: MoneyLike): string {
  return (agorot(value) / MONEY_SCALE).toFixed(MONEY_DECIMAL_PLACES);
}

function describe(label: string, actual: MoneyLike, expected: MoneyLike): string {
  const off = (agorot(actual) - agorot(expected)) / MONEY_SCALE;
  const drift = off === 0 ? "" : ` (off by ${off > 0 ? "+" : ""}${off.toFixed(MONEY_DECIMAL_PLACES)})`;
  return `${label}: expected ${money(expected)}, got ${money(actual)}${drift}`;
}

/** Exactly this amount, and as a 2dp string: a number in a money field is how float drift gets in. */
export function expectMoney(actual: MoneyLike, expected: MoneyLike, label: string): void {
  expectMoneyShape(actual, label);
  expect(agorot(actual), describe(label, actual, expected)).toBe(agorot(expected));
}

/** A catalogue price: a Decimal serialized unpadded ("60"), but still an exact string, never a Float. */
export function expectPrice(actual: MoneyLike, expected: MoneyLike, label: string): void {
  expect(
    typeof actual,
    `${label}: a price must cross the API as a string (Decimal, never Float) — got a ${typeof actual}: ${JSON.stringify(actual)}`,
  ).toBe("string");
  expect(agorot(actual), describe(label, actual, expected)).toBe(agorot(expected));
}

/** The same comparison for a figure that is computed rather than read back. */
export function expectAmount(actual: MoneyLike, expected: MoneyLike, label: string): void {
  expect(agorot(actual), describe(label, actual, expected)).toBe(agorot(expected));
}

/** Money leaves the API as a fixed 2dp string, never a float. */
export function expectMoneyShape(actual: MoneyLike, label: string): void {
  expect(
    typeof actual,
    `${label}: money must cross the API as a 2dp string (Decimal, never Float) — got a ${typeof actual}: ${JSON.stringify(actual)}`,
  ).toBe("string");
  expect(
    MONEY_STRING_PATTERN.test(String(actual)),
    `${label}: money must be a plain 2dp string — got ${JSON.stringify(actual)}`,
  ).toBe(true);
}

/** How much a figure moved, asserted exactly. The workhorse against a live database. */
export function expectDelta(after: MoneyLike, before: MoneyLike, expected: MoneyLike, label: string): void {
  const moved = (agorot(after) - agorot(before)) / MONEY_SCALE;
  expect(agorot(moved), describe(`${label} (moved by)`, moved, expected)).toBe(agorot(expected));
}

/** A whole number — stock, quantities, order counts. */
export function expectCount(actual: unknown, expected: number, label: string): void {
  expect(actual, `${label}: expected ${expected}, got ${String(actual)}`).toBe(expected);
}

export function expectCountDelta(after: number, before: number, expected: number, label: string): void {
  const moved = after - before;
  expect(moved, `${label} (moved by): expected ${expected}, got ${moved}`).toBe(expected);
}

/** `a` and `b` add back up to `whole`, exactly — sold = received + owed. */
export function expectSum(parts: MoneyLike[], whole: MoneyLike, label: string): void {
  const summed = parts.reduce<number>((total, part) => total + agorot(part), 0) / MONEY_SCALE;
  expect(agorot(summed), describe(label, summed, whole)).toBe(agorot(whole));
}
