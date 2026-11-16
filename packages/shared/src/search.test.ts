import { describe, expect, it } from 'vitest';
import { ean13CheckDigit, isValidEan13, normalizeBarcode, skuFor } from './barcode.js';
import { buildSearchText, localize, normalizeSearch } from './search.js';

describe('search normalisation', () => {
  it('unifies Arabic letter forms and strips diacritics', () => {
    expect(normalizeSearch('فُسْتانٌ أحمر')).toBe(normalizeSearch('فستان احمر'));
    expect(normalizeSearch('شالة')).toBe('شاله');
    expect(normalizeSearch('مستشفى')).toBe('مستشفي');
    expect(normalizeSearch('  Dress  RED ')).toBe('dress red');
    expect(normalizeSearch('مقاس ٤٢')).toBe('مقاس 42');
  });

  it('joins every language', () => {
    expect(buildSearchText({ ar: 'شال', en: 'Shawl' }, 'ORG-00001')).toBe('شال shawl org-00001');
  });

  it('localizes with fallback to Arabic', () => {
    expect(localize({ ar: 'شال', en: 'Shawl' }, 'he')).toBe('شال');
    expect(localize({ en: 'Shawl' }, 'ar')).toBe('Shawl');
  });
});

describe('barcodes', () => {
  it('computes EAN-13 check digits', () => {
    expect(ean13CheckDigit('400638133393')).toBe(1);
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('4006381333932')).toBe(false);
  });

  it('normalizes scanned codes', () => {
    expect(normalizeBarcode(' ٢٠٠ 123 ')).toBe('200123');
  });

  it('formats SKUs', () => {
    expect(skuFor(42)).toBe('ORG-00042');
    expect(skuFor(42, 3)).toBe('ORG-00042-3');
  });
});
