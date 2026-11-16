import { useEffect, useRef } from 'react';
import { isModifierKey, physicalKeyChar } from '@web/shared/lib/keyboard';

export const SCAN_MAX_KEY_GAP_MS = 40;
export const SCAN_MIN_LENGTH = 4;
const TERMINATORS = ['Enter', 'NumpadEnter', 'Tab'];
const DEDUPE_MS = 1000;

/**
 * Listens for a hardware scanner anywhere on the page (ported): keys arriving faster than a person
 * types, ending in Enter or Tab. Ignored while the person is typing into a field.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true): void {
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    let buffer = '';
    let last = 0;
    let lastCode = '';
    let lastCodeAt = 0;

    const typing = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        event.repeat ||
        typing(event.target)
      ) {
        buffer = '';
        return;
      }
      if (isModifierKey(event)) return;
      const gap = event.timeStamp - last;
      if (TERMINATORS.includes(event.code)) {
        const code = buffer;
        buffer = '';
        if (code.length < SCAN_MIN_LENGTH || gap > SCAN_MAX_KEY_GAP_MS) return;
        event.preventDefault();
        event.stopPropagation();
        if (code === lastCode && event.timeStamp - lastCodeAt < DEDUPE_MS) return;
        lastCode = code;
        lastCodeAt = event.timeStamp;
        handler.current(code);
        return;
      }
      const char = physicalKeyChar(event);
      if (char === null) {
        buffer = '';
        return;
      }
      buffer = gap > SCAN_MAX_KEY_GAP_MS ? char : buffer + char;
      last = event.timeStamp;
    };
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [enabled]);
}
