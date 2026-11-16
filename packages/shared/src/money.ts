/**
 * Money is carried as a decimal string with two places ("120.50") on the wire and in the
 * database (numeric(12,2)), and as integer minor units (12050) for arithmetic. A numeric(12,2)
 * fits well inside Number.MAX_SAFE_INTEGER minor units, so plain numbers are exact here.
 */

export const MONEY_SCALE = 2;
const FACTOR = 100;
const MONEY_PATTERN = /^-?\d+(\.\d+)?$/;

/** Parses a decimal string or number into minor units, rounding half away from zero. */
export function toMinor(value: string | number): number {
  const text = typeof value === 'number' ? numberToPlainString(value) : value.trim();
  if (!MONEY_PATTERN.test(text)) throw new RangeError(`Not a money amount: ${String(value)}`);
  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const kept = fraction.slice(0, MONEY_SCALE).padEnd(MONEY_SCALE, '0');
  const nextDigit = Number(fraction.charAt(MONEY_SCALE) || '0');
  let minor = Number(whole) * FACTOR + Number(kept);
  if (nextDigit >= 5) minor += 1;
  return negative && minor !== 0 ? -minor : minor;
}

/** Formats minor units as a two-place decimal string. */
export function fromMinor(minor: number): string {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Not whole minor units: ${minor}`);
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / FACTOR);
  const fraction = String(abs % FACTOR).padStart(MONEY_SCALE, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/** Normalises any accepted money input to the canonical two-place string. */
export function normalizeMoney(value: string | number): string {
  return fromMinor(toMinor(value));
}

export function addMoney(...values: (string | number)[]): string {
  return fromMinor(values.reduce<number>((sum, v) => sum + toMinor(v), 0));
}

/** Multiplies an amount by a quantity or rate and rounds half-up once, at the end. */
export function multiplyMoney(amount: string | number, factor: string | number): string {
  const minor = toMinor(amount);
  const f = typeof factor === 'number' ? numberToPlainString(factor) : factor.trim();
  if (!MONEY_PATTERN.test(f)) throw new RangeError(`Not a factor: ${String(factor)}`);
  const [w = '0', d = ''] = f.replace('-', '').split('.');
  const scale = 10 ** d.length;
  const scaled = BigInt(minor) * BigInt(w + d);
  const negative = scaled < 0n !== f.startsWith('-');
  const absScaled = scaled < 0n ? -scaled : scaled;
  const big = BigInt(scale);
  let q = absScaled / big;
  if ((absScaled % big) * 2n >= big) q += 1n;
  const result = Number(q);
  return fromMinor(negative && result !== 0 ? -result : result);
}

/**
 * Splits a total across weights (for spreading shipping over lines or a discount over lines)
 * so the parts always add up to the total exactly. Remainders go to the largest weights first.
 */
export function allocateMoney(total: string | number, weights: number[]): string[] {
  const minor = toMinor(total);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum <= 0) {
    const parts = weights.map(() => 0);
    parts[0] = minor;
    return parts.map(fromMinor);
  }
  const raw = weights.map((w) => (minor * w) / sum);
  const parts = raw.map((r) => Math.trunc(r));
  let left = minor - parts.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, rest: Math.abs(r - Math.trunc(r)) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  const step = left >= 0 ? 1 : -1;
  for (let k = 0; left !== 0; k = (k + 1) % order.length) {
    const target = order[k];
    if (!target) break;
    parts[target.i] = (parts[target.i] ?? 0) + step;
    left -= step;
  }
  return parts.map(fromMinor);
}

export function compareMoney(a: string | number, b: string | number): number {
  return Math.sign(toMinor(a) - toMinor(b));
}

export function isZeroMoney(value: string | number): boolean {
  return toMinor(value) === 0;
}

function numberToPlainString(value: number): string {
  if (!Number.isFinite(value)) throw new RangeError(`Not a finite amount: ${value}`);
  const text = String(value);
  if (!/e/i.test(text)) return text;
  return value.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}
