/**
 * Hardware scanners type as a US keyboard. Reading `event.code` (the physical key) instead of
 * `event.key` keeps codes Latin when the computer is on an Arabic or Hebrew layout. Ported.
 */
const SHIFTED: Record<string, string> = { Minus: '_', Period: '>', Slash: '?', Equal: '+' };
const PLAIN: Record<string, string> = {
  Minus: '-',
  Period: '.',
  Slash: '/',
  Equal: '=',
  Space: ' ',
};

export function physicalKeyChar(
  event: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'getModifierState'>,
): string | null {
  const { code } = event;
  if (/^Digit\d$/.test(code)) return event.shiftKey ? null : code.slice(5);
  if (/^Numpad\d$/.test(code)) return code.slice(6);
  if (/^Key[A-Z]$/.test(code)) {
    const upper = event.shiftKey !== event.getModifierState('CapsLock');
    const letter = code.slice(3);
    return upper ? letter : letter.toLowerCase();
  }
  if (code === 'NumpadSubtract') return '-';
  if (code === 'NumpadDecimal') return '.';
  return (event.shiftKey ? SHIFTED[code] : PLAIN[code]) ?? null;
}

export function isModifierKey(event: Pick<KeyboardEvent, 'key'>): boolean {
  return ['Shift', 'CapsLock', 'Control', 'Alt', 'Meta'].includes(event.key);
}
