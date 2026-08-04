import { MONEY_DECIMAL_PLACES, PERCENT_MAX } from "@shared/constants/order";
import type { DiscountType } from "@shared/types/order";

// Integer-cent arithmetic for the running total shown on the selling screen.
//
// The server is still the only authority on what a sale costs — it re-prices
// every line from the catalogue at checkout (backend/src/lib/orderPricing.ts)
// and ignores any total a client sends. What this file has to guarantee is
// that the figure the cashier reads out loud *before* tapping checkout is the
// same one the receipt ends up showing, so it deliberately mirrors the
// backend's Decimal rules: round to 2 places, half-up, and clamp a discount
// to the amount it applies to. Floats are avoided for the same reason the
// schema forbids them — 0.1 + 0.2 has no business anywhere near a till.

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
// must not be able to poison the total the cashier is reading.
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * CENTS_PER_UNIT);
}

// Back to the fixed-2dp string shape the API speaks, so the same value can
// be handed to the currency formatter or sent back as-is.
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

  const raw =
    type === "PERCENT"
      ? divideRoundHalfUp(baseCents * toCents(value), PERCENT_BASIS)
      : toCents(value);

  if (raw < 0) return 0;
  return raw > baseCents ? baseCents : raw;
}

// A percentage over 100 discounts more than the whole line — clamped by
// resolveDiscountCents above, but caught at input time so the cashier sees
// why rather than watching a number silently stop moving.
export function isDiscountValueInRange(type: DiscountType, value: string): boolean {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return false;
  return type === "PERCENT" ? parsed <= PERCENT_MAX : true;
}
