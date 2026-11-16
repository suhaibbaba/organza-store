import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

describe('csv', () => {
  it('quotes only what needs quoting', () => {
    expect(
      toCsv([
        ['a', 'b,c', 'say "hi"'],
        [1, null, 'x\ny'],
      ]),
    ).toBe('a,"b,c","say ""hi"""\r\n1,,"x\ny"');
  });
});
