import { Prisma } from "@prisma/client";
import { MONEY_DECIMAL_PLACES } from "@/constants";
import type { DiscountType } from "@/types";

// All order arithmetic in Decimal (never Float), rounded to the column's 2 places, so computed, stored and returned agree.

export type Money = Prisma.Decimal;

export function money(value: Prisma.Decimal.Value): Money {
  return new Prisma.Decimal(value);
}

export const ZERO_MONEY = (): Money => money(0);

export function roundMoney(value: Money): Money {
  return value.toDecimalPlaces(MONEY_DECIMAL_PLACES, Prisma.Decimal.ROUND_HALF_UP);
}

// Money leaves the API as a fixed-2dp string: floats can't hold every 2dp value exactly.
export function formatMoney(value: Prisma.Decimal.Value | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return roundMoney(money(value)).toFixed(MONEY_DECIMAL_PLACES);
}

// Would an incoming money field change what is stored? `undefined` means not sent, `null` means clear it.
export function moneyChanged(input: Prisma.Decimal.Value | null | undefined, current: Prisma.Decimal | null): boolean {
  if (input === undefined) {
    return false;
  }
  if (input === null || current === null) {
    return input !== current;
  }
  return !money(input).equals(current);
}

// Resolves a (type, value) discount, clamped so it never exceeds its base or becomes a surcharge.
export function resolveDiscountAmount(
  base: Money,
  type: DiscountType | null | undefined,
  value: Prisma.Decimal.Value | null | undefined,
): Money {
  if (!type || value === null || value === undefined) {
    return ZERO_MONEY();
  }

  const raw = type === "PERCENT" ? base.mul(money(value)).div(100) : money(value);
  const clamped = raw.lessThan(0) ? ZERO_MONEY() : raw.greaterThan(base) ? base : raw;
  return roundMoney(clamped);
}

// Zero in the 2dp string shape every money field crosses the API in.
export function zeroMoneyText(): string {
  return ZERO_MONEY().toFixed(MONEY_DECIMAL_PLACES);
}
