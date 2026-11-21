import { MONEY_DECIMAL_PLACES, PERCENT_MAX } from "@store/shared/constants/order";
import type { DiscountType } from "@store/shared/types/order";

// Integer cents mirroring the backend's Decimal rules, so the total read to the customer is what the saved order shows.

const CENTS_PER_UNIT = 10 ** MONEY_DECIMAL_PLACES;
// Hundredths of a percent, keeping everything in integers.
const PERCENT_BASIS = 100 * CENTS_PER_UNIT;

// The same tie-breaking as Prisma's ROUND_HALF_UP.
function divideRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

// Unparseable is zero, never NaN, so a bad discount can't poison the total.
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * CENTS_PER_UNIT);
}

export function fromCents(cents: number): string {
  return (cents / CENTS_PER_UNIT).toFixed(MONEY_DECIMAL_PLACES);
}

export function multiplyCents(unitCents: number, quantity: number): number {
  return unitCents * quantity;
}

// Mirrors the backend's resolveDiscountAmount: never more than the base, never a surcharge.
export function resolveDiscountCents(
  baseCents: number,
  type: DiscountType | null | undefined,
  value: string | null | undefined,
): number {
  if (!type || value === null || value === undefined || value === "") {
    return 0;
  }

  const raw = type === "PERCENT" ? divideRoundHalfUp(baseCents * toCents(value), PERCENT_BASIS) : toCents(value);

  if (raw < 0) {
    return 0;
  }
  return raw > baseCents ? baseCents : raw;
}

// Caught at input so the person is told which limit they crossed.
export function isDiscountValueInRange(type: DiscountType, value: string, baseAmount?: string): boolean {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return false;
  }
  if (type === "PERCENT") {
    return parsed <= PERCENT_MAX;
  }
  // No base yet (empty cart): the clamp still applies later.
  if (baseAmount === undefined) {
    return true;
  }
  return toCents(value) <= toCents(baseAmount);
}

export function maxDiscountValue(type: DiscountType, baseAmount: string): number {
  return type === "PERCENT" ? PERCENT_MAX : Math.floor(toCents(baseAmount) / 10 ** MONEY_DECIMAL_PLACES);
}
