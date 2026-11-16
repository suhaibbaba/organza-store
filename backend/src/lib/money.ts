import { Prisma } from "@prisma/client";
import { MONEY_DECIMAL_PLACES } from "@/constants";
import type { DiscountType } from "@/types";

// All order arithmetic runs through Prisma's Decimal (CLAUDE.md: money is
// never a Float) and is rounded to the same 2 places the DB column stores,
// so what is computed, what is written and what is returned always agree.

export type Money = Prisma.Decimal;

export function money(value: Prisma.Decimal.Value): Money {
  return new Prisma.Decimal(value);
}

export const ZERO_MONEY = (): Money => money(0);

export function roundMoney(value: Money): Money {
  return value.toDecimalPlaces(MONEY_DECIMAL_PLACES, Prisma.Decimal.ROUND_HALF_UP);
}

// Money leaves the API as a fixed-2dp string rather than a JS number:
// floats can't hold every 2dp value exactly, and a string round-trips into
// the frontend's own formatter untouched.
export function formatMoney(value: Prisma.Decimal.Value | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return roundMoney(money(value)).toFixed(MONEY_DECIMAL_PLACES);
}

// Would an incoming money field actually change what is stored? Used by the
// permission gates that refuse a *change* rather than the field itself
// (product.editPrice), so a form resending a value untouched still saves.
// `undefined` means the field wasn't sent at all; `null` means "clear it".
export function moneyChanged(
  input: Prisma.Decimal.Value | null | undefined,
  current: Prisma.Decimal | null
): boolean {
  if (input === undefined) return false;
  if (input === null || current === null) return input !== current;
  return !money(input).equals(current);
}

// Resolves a (type, value) discount against the amount it applies to.
// Clamped to that base in both directions, so a discount can never exceed
// the thing it discounts or turn into a surcharge.
export function resolveDiscountAmount(
  base: Money,
  type: DiscountType | null | undefined,
  value: Prisma.Decimal.Value | null | undefined
): Money {
  if (!type || value === null || value === undefined) return ZERO_MONEY();

  const raw = type === "PERCENT" ? base.mul(money(value)).div(100) : money(value);
  const clamped = raw.lessThan(0) ? ZERO_MONEY() : raw.greaterThan(base) ? base : raw;
  return roundMoney(clamped);
}
