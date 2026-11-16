import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBarcodeScanner } from './use-barcode-scanner';

function press(code: string, timeStamp: number, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    code,
    key: code,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  document.body.dispatchEvent(event);
}

const type = (text: string, start: number, gap: number) => {
  let t = start;
  for (const ch of text) {
    press(/\d/.test(ch) ? `Digit${ch}` : `Key${ch.toUpperCase()}`, t, {
      shiftKey: ch !== ch.toLowerCase(),
    });
    t += gap;
  }
  press('Enter', t);
};

describe('useBarcodeScanner', () => {
  it('reports fast key bursts ending in Enter, whatever the keyboard layout', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner(onScan));
    type('2001234567897', 1000, 10);
    expect(onScan).toHaveBeenCalledWith('2001234567897');
  });

  it('ignores a person typing slowly and repeats within a second', () => {
    const onScan = vi.fn();
    renderHook(() => useBarcodeScanner(onScan));
    type('12345', 5000, 200);
    expect(onScan).not.toHaveBeenCalled();
    type('ABC123', 10_000, 5);
    type('ABC123', 10_200, 5);
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('ABC123');
  });
});
