import { MONEY_DECIMAL_PLACES, PERCENT_MAX } from "@shared/constants/order";
import type { DiscountType } from "@shared/types/order";

// Integer-cent arithmetic for the running total shown while an order is being
// built (see components/orders/new-order/*).
//
// The server is still the only authority on what an order costs — it prices
// every line from the catalogue (backend/src/lib/orderPricing.ts) and ignores
// any total a client sends. What this file guarantees is that the figure the
// staff member reads back to the customer over WhatsApp *before* saving is
// the same one the saved order ends up showing, so it mirrors the backend's
// Decimal rules exactly: round to 2 places, half-up, and clamp a discount to
// the amount it applies to. Floats are avoided for the same reason the schema
// forbids them — 0.1 + 0.2 has no business anywhere near a price.
//
// Deliberately a copy of pos/src/lib/money.ts rather than a shared import:
// `shared/` is types + schemas + pure rules, and both apps need this
// identically. If a third caller appears it should move to `shared/`.

const CENTS_PER_UNIT = 10 ** MONEY_DECIMAL_PLACES;
// A percentage is itself a 2dp figure ("12.5%"), so it is carried as
// hundredths of a percent to keep the whole calculation in integers.
const PERCENT_BASIS = 100 * CENTS_PER_UNIT;

// Divides two positive integers, rounding half away from zero — the same
// tie-breaking Prisma's ROUND_HALF_UP applies on the backend.
function divideRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

// Parses an API money string ("120.50") or a typed-in amount into cents.
// Anything unparseable is worth zero rather than NaN: a malformed discount
// must not be able to poison the total on screen.
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * CENTS_PER_UNIT);
}

// Back to the fixed-2dp string shape the API speaks, so the same value can be
// handed to the currency formatter or sent back as-is.
export function fromCents(cents: number): string {
  return (cents / CENTS_PER_UNIT).toFixed(MONEY_DECIMAL_PLACES);
}

export function multiplyCents(unitCents: number, quantity: number): number {
  return unitCents * quantity;
}

// Mirrors backend/src/lib/money.ts's resolveDiscountAmount: a (type, value)
// pair resolved against the amount it applies to, clamped in both directions
// so a discount can neither exceed what it discounts nor become a surcharge.
export function resolveDiscountCents(
  baseCents: number,
  type: DiscountType | null | undefined,
  value: string | null | undefined
): number {
  if (!type || value === null || value === undefined || value === "") return 0;

  const raw = type === "PERCENT" ? divideRoundHalfUp(baseCents * toCents(value), PERCENT_BASIS) : toCents(value);

  if (raw < 0) return 0;
  return raw > baseCents ? baseCents : raw;
}

// Both kinds of discount have a ceiling, and it is the same ceiling stated
// two ways: you cannot take off more than there is. A percentage stops at
// 100; a flat sum stops at the amount it applies to. resolveDiscountCents
// above clamps either one anyway, but silently — so this catches it at input
// time, where the person can be told which limit they crossed instead of
// watching a number stop moving for no visible reason.
export function isDiscountValueInRange(type: DiscountType, value: string, baseAmount?: string): boolean {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return false;
  if (type === "PERCENT") return parsed <= PERCENT_MAX;
  // No base given means the caller has nothing to measure against (an order
  // discount before anything is in the cart) — the clamp still applies later.
  if (baseAmount === undefined) return true;
  return toCents(value) <= toCents(baseAmount);
}

// The most a discount of this type may be, for the field's own digit cap and
// for the message that explains the limit.
export function maxDiscountValue(type: DiscountType, baseAmount: string): number {
  return type === "PERCENT" ? PERCENT_MAX : Math.floor(toCents(baseAmount) / 10 ** MONEY_DECIMAL_PLACES);
}
