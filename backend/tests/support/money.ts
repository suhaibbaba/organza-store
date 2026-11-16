// Asserting on money, so that a failure names the figure rather than the
// field.
//
// Every helper here fails with "<what it is>: expected 162.00, got 161.99
// (off by 0.01)". A money bug found at 2am by someone who is not a
// programmer has to be readable as a sentence about money, not as a diff of
// two JSON blobs.
//
// Comparisons run on scaled integers — the amounts are turned into agorot
// before they are compared — so the assertion path cannot itself introduce
// the floating-point drift it exists to catch.
import { expect } from "vitest";
import { MONEY_DECIMAL_PLACES, MONEY_SCALE, MONEY_STRING_PATTERN } from "@tests/constants";

export type MoneyLike = string | number | null | undefined;

/** The scaled integer an amount really is: "162.00" -> 16200. */
export function agorot(value: MoneyLike): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) throw new Error(`Not an amount: ${JSON.stringify(value)}`);
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

/**
 * An amount is exactly the figure it should be.
 *
 * Also insists on the SHAPE: a 2dp string. A number where a string belongs is
 * how float drift gets into a money field in the first place, so a response
 * that has started returning 0.30000000000000004 fails here even though it
 * rounds to the right answer.
 */
export function expectMoney(actual: MoneyLike, expected: MoneyLike, label: string): void {
  expectMoneyShape(actual, label);
  expect(agorot(actual), describe(label, actual, expected)).toBe(agorot(expected));
}

/**
 * A CATALOGUE price — a product's basePrice, a variant's resolvedCost.
 *
 * These are Prisma Decimals serialized straight to JSON rather than passed
 * through formatMoney, so they arrive unpadded ("60", not "60.00"). Still a
 * string, and still exact — which is the part that matters: a Float here
 * would be the bug.
 */
export function expectPrice(actual: MoneyLike, expected: MoneyLike, label: string): void {
  expect(
    typeof actual,
    `${label}: a price must cross the API as a string (Decimal, never Float) — got a ${typeof actual}: ${JSON.stringify(actual)}`
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
    `${label}: money must cross the API as a 2dp string (Decimal, never Float) — got a ${typeof actual}: ${JSON.stringify(actual)}`
  ).toBe("string");
  expect(
    MONEY_STRING_PATTERN.test(String(actual)),
    `${label}: money must be a plain 2dp string — got ${JSON.stringify(actual)}`
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
