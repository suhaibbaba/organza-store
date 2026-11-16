import { describe, expect, it } from 'vitest';
import { dualPrefixCandidates, nationalPhoneDigits, phoneIdentityKey, toE164 } from './phone.js';

describe('phone', () => {
  it('turns local input into E.164 with the default prefix', () => {
    expect(toE164('0599 123 456')).toBe('+970599123456');
    expect(toE164('٠٥٩٩١٢٣٤٥٦', '+972')).toBe('+972599123456');
    expect(toE164('00972599123456')).toBe('+972599123456');
    expect(toE164('+1 415 555 2671')).toBe('+14155552671');
  });
  it('refuses what is not a phone number', () => {
    expect(toE164('12')).toBeNull();
    expect(toE164('')).toBeNull();
    expect(toE164('+970123')).toBeNull();
  });
  it('treats +970 and +972 as the same line without rewriting it', () => {
    expect(dualPrefixCandidates('+970599123456')).toEqual(['+970599123456', '+972599123456']);
    expect(phoneIdentityKey('+972599123456')).toBe(phoneIdentityKey('+970599123456'));
    expect(nationalPhoneDigits('+972599123456')).toBe('599123456');
  });
});
