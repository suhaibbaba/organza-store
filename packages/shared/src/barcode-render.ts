import { isValidEan13 } from './barcode.js';

/**
 * Barcode bar patterns for labels, without a dependency: EAN-13 for in-store codes, Code 128-B for
 * anything else (supplier codes, SKUs). Returns module runs, starting with a bar; the label draws
 * them as SVG rectangles so they stay crisp at any printer DPI.
 */
export interface BarPattern {
  format: 'EAN13' | 'CODE128';
  /** Alternating bar/space widths in modules, starting with a bar. */
  runs: number[];
  /** Bars that extend below the others (EAN guard bars), by run index. */
  guards: Set<number>;
  text: string;
}

const L = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const G = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];
const R = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
];
const PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

function toRuns(
  bits: string,
  guardRanges: [number, number][],
): { runs: number[]; guards: Set<number> } {
  const runs: number[] = [];
  const guards = new Set<number>();
  let i = 0;
  // Leading zeros are quiet zone handled by the renderer; patterns here start with a 1.
  while (i < bits.length) {
    const bit = bits[i];
    let n = 0;
    const start = i;
    while (i < bits.length && bits[i] === bit) {
      i++;
      n++;
    }
    if (bit === '1' && guardRanges.some(([a, b]) => start >= a && start < b))
      guards.add(runs.length);
    runs.push(n);
  }
  return { runs, guards };
}

export function ean13Pattern(code: string): BarPattern {
  const first = Number(code[0]);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[first]![i - 1] === 'L' ? L : G)[Number(code[i])]!;
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[Number(code[i])]!;
  bits += '101';
  const { runs, guards } = toRuns(bits, [
    [0, 3],
    [45, 50],
    [92, 95],
  ]);
  return { format: 'EAN13', runs, guards, text: code };
}

/** Code 128 symbol widths (bar, space, bar, space, bar, space), index = symbol value. */
const C128 = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
];
const C128_STOP = '2331112';
const START_B = 104;

export function code128Pattern(text: string): BarPattern {
  const values = [START_B, ...[...text].map((ch) => ch.charCodeAt(0) - 32)];
  if (values.slice(1).some((v) => v < 0 || v > 94))
    throw new Error('Code 128-B covers printable ASCII only');
  const checksum = values.reduce((sum, v, i) => sum + v * (i === 0 ? 1 : i), 0) % 103;
  const widths = [...values, checksum].map((v) => C128[v]!).join('') + C128_STOP;
  return { format: 'CODE128', runs: [...widths].map(Number), guards: new Set(), text };
}

export function barcodePattern(code: string): BarPattern {
  return isValidEan13(code) ? ean13Pattern(code) : code128Pattern(code);
}

export function patternWidth(pattern: BarPattern): number {
  return pattern.runs.reduce((a, b) => a + b, 0);
}
