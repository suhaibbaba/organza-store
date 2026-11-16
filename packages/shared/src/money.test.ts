import { describe, expect, it } from 'vitest';
import {
  addMoney,
  allocateMoney,
  fromMinor,
  multiplyMoney,
  normalizeMoney,
  toMinor,
} from './money.js';

describe('money', () => {
  it('parses and rounds half up', () => {
    expect(toMinor('120.5')).toBe(12050);
    expect(toMinor('0.005')).toBe(1);
    expect(toMinor('0.004')).toBe(0);
    expect(toMinor('-1.005')).toBe(-101);
    expect(toMinor(19.99)).toBe(1999);
    expect(() => toMinor('abc')).toThrow();
  });

  it('formats minor units', () => {
    expect(fromMinor(5)).toBe('0.05');
    expect(fromMinor(-12050)).toBe('-120.50');
    expect(normalizeMoney('7')).toBe('7.00');
  });

  it('adds without float drift', () => {
    expect(addMoney('0.1', '0.2')).toBe('0.30');
  });

  it('multiplies with a single rounding', () => {
    expect(multiplyMoney('10.00', '3.6721')).toBe('36.72');
    expect(multiplyMoney('0.05', '0.5')).toBe('0.03');
    expect(multiplyMoney('-10.00', 3)).toBe('-30.00');
  });

  it('allocates so the parts add up exactly', () => {
    const parts = allocateMoney('10.00', [1, 1, 1]);
    expect(parts).toEqual(['3.34', '3.33', '3.33']);
    expect(addMoney(...parts)).toBe('10.00');
    expect(allocateMoney('5.00', [0, 0])).toEqual(['5.00', '0.00']);
  });
});
