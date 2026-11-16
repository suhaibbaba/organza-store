/** Weighted-average cost arithmetic with 4 decimal places, done in integers. */
const SCALE = 10_000;

export const toCostUnits = (value: string | number): number => Math.round(Number(value) * SCALE);
export const fromCostUnits = (units: number): string => (units / SCALE).toFixed(4);

/** New average after `quantity` units arrive at `unitCost` onto `onHand` units at `avg`. */
export function averageIn(
  onHand: number,
  avg: string | null,
  quantity: number,
  unitCost: string,
): string {
  if (avg === null || onHand <= 0) return fromCostUnits(toCostUnits(unitCost));
  const total = onHand * toCostUnits(avg) + quantity * toCostUnits(unitCost);
  return fromCostUnits(Math.round(total / (onHand + quantity)));
}

/** Average after taking back units that had come in at `unitCost` (reversal of a receipt). */
export function averageOut(
  onHand: number,
  avg: string | null,
  quantity: number,
  unitCost: string,
): string | null {
  if (avg === null) return null;
  const remaining = onHand - quantity;
  if (remaining <= 0) return avg;
  const total = onHand * toCostUnits(avg) - quantity * toCostUnits(unitCost);
  return fromCostUnits(Math.max(0, Math.round(total / remaining)));
}

/** Money value of a quantity at a unit cost, rounded half-up to cents. */
export function valueOf(quantity: number, unitCost: string): string {
  const cents = Math.round((Math.abs(quantity) * toCostUnits(unitCost)) / (SCALE / 100));
  return (cents / 100).toFixed(2);
}
