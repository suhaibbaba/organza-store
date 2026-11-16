import { describe, expect, it } from 'vitest';
import { code128Pattern, ean13Pattern, patternWidth } from './barcode-render.js';

describe('barcode patterns', () => {
  it('EAN-13 is 95 modules with three guard groups', () => {
    const p = ean13Pattern('4006381333931');
    expect(patternWidth(p)).toBe(95);
    expect(p.guards.size).toBe(6);
  });

  it('Code 128-B has 11 modules per symbol plus a 13-module stop', () => {
    const p = code128Pattern('ORG-00042-1');
    // start + 11 chars + checksum = 13 symbols.
    expect(patternWidth(p)).toBe(13 * 11 + 13);
    // Checksum for "PJJ123C" is (104 + 671) mod 103 = 55: symbol 311321, just before the stop.
    const q = code128Pattern('PJJ123C');
    expect(q.runs.slice(-13, -7).join('')).toBe('311321');
  });
});
