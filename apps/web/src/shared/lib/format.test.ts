import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber, toLatinDigits } from './format';

describe('format', () => {
  it('uses western digits in Arabic', () => {
    expect(formatNumber(1250, 'ar')).toMatch(/1.?250/);
    expect(formatNumber(1250, 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatMoney('120.5', 'ILS', 'ar')).toMatch(/120[.,٫]50/);
    expect(formatMoney('120.5', 'ILS', 'ar')).not.toMatch(/[٠-٩]/);
  });

  it('converts typed Arabic-Indic digits', () => {
    expect(toLatinDigits('٠٥٩٩١٢٣')).toBe('0599123');
    expect(toLatinDigits('۱۲۳')).toBe('123');
  });
});
