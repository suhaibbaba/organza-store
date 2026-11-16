import { describe, expect, it } from 'vitest';
import { type Cart, type CartLine, cartTotals } from './cart';

const line = (unitPrice: string, quantity: number, discount = '0.00'): CartLine => ({
  key: unitPrice + quantity,
  itemId: unitPrice,
  productId: 'p',
  name: { ar: 'x' },
  variantLabel: null,
  sku: 'S',
  imageUrl: null,
  unitPrice,
  quantity,
  discount,
  available: 10,
});

const cart = (lines: CartLine[], cartDiscount = '0.00'): Cart => ({
  idempotencyKey: 'k',
  lines,
  customer: null,
  cartDiscount,
  note: '',
});

describe('cartTotals', () => {
  it('adds lines and line discounts', () => {
    const t = cartTotals(cart([line('100.00', 2, '20.00'), line('50.00', 1)]));
    expect(t).toEqual({ subtotal: '250.00', discountTotal: '20.00', total: '230.00', count: 3 });
  });

  it('spreads a cart discount without losing a cent', () => {
    const t = cartTotals(cart([line('10.00', 1), line('10.00', 1), line('10.00', 1)], '10.00'));
    expect(t.discountTotal).toBe('10.00');
    expect(t.total).toBe('20.00');
  });

  it('never discounts below zero', () => {
    const t = cartTotals(cart([line('30.00', 1)], '50.00'));
    expect(t.total).toBe('0.00');
  });
});
