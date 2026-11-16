import { PAPER_DOTS, type PaperWidth } from '@web/shared/printing/escpos';
import type { ReceiptBlock } from './receipt-blocks';

/**
 * Paints receipt blocks onto a canvas the width of the printer head (576 dots on 80 mm paper).
 * The browser lays out the text, so Arabic letters join and right-to-left lines run the right
 * way, which printer fonts cannot do. The result goes through `receiptJob` as a raster image.
 */
export async function paintReceipt(
  blocks: ReceiptBlock[],
  { rtl, paper = 80, font = 'Cairo' }: { rtl: boolean; paper?: PaperWidth; font?: string },
): Promise<ImageData> {
  const width = PAPER_DOTS[paper];
  const scale = width / 576;
  const size = { title: 34 * scale, base: 25 * scale, small: 21 * scale };
  const family = `${font}, "Noto Sans Hebrew", Arial, sans-serif`;
  await Promise.all(
    ['400', '700'].map((w) => document.fonts?.load(`${w} ${size.base}px ${font}`).catch(() => [])),
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 6000;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  ctx.direction = rtl ? 'rtl' : 'ltr';

  const start = rtl ? width : 0;
  const end = rtl ? 0 : width;
  const startAlign: CanvasTextAlign = rtl ? 'right' : 'left';
  const endAlign: CanvasTextAlign = rtl ? 'left' : 'right';
  let y = 4;

  const setFont = (px: number, bold = false) => {
    ctx.font = `${bold ? 700 : 400} ${px}px ${family}`;
  };
  const wrap = (text: string, max: number): string[] => {
    const lines: string[] = [];
    let current = '';
    for (const word of text.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= max || !current) current = next;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  };
  const text = (value: string, x: number, align: CanvasTextAlign, px: number, bold = false) => {
    setFont(px, bold);
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  };
  const centered = (value: string, px: number, bold = false, ltr = false) => {
    setFont(px, bold);
    ctx.direction = ltr ? 'ltr' : rtl ? 'rtl' : 'ltr';
    for (const line of wrap(value, width)) {
      ctx.textAlign = 'center';
      ctx.fillText(line, width / 2, y);
      y += px * 1.35;
    }
    ctx.direction = rtl ? 'rtl' : 'ltr';
  };
  const rule = () => {
    y += 4;
    for (let x = 0; x < width; x += 12) ctx.fillRect(x, y, 6, 2);
    y += 10;
  };
  /** A label at the start and a value at the end; the label wraps if they would meet. */
  const pair = (label: string, value: string, px: number, bold = false) => {
    setFont(px, bold);
    const valueWidth = value ? ctx.measureText(value).width + 16 : 0;
    const lines = wrap(label, width - valueWidth);
    text(value, end, endAlign, px, bold);
    for (const line of lines) {
      text(line, start, startAlign, px, bold);
      y += px * 1.35;
    }
  };

  for (const b of blocks) {
    switch (b.kind) {
      case 'title':
        centered(b.text, size.title, true);
        break;
      case 'center':
        centered(b.text, size.base, false, b.ltr);
        break;
      case 'meta':
        y += 6;
        pair(b.start, b.end, size.small);
        break;
      case 'note':
        y += 4;
        centered(b.text, size.base, true);
        y += 4;
        break;
      case 'rule':
        rule();
        break;
      case 'line':
        y += 3;
        pair(b.name, b.amount, size.base);
        for (const d of b.details) {
          setFont(size.small);
          for (const line of wrap(d, width)) {
            text(line, start, startAlign, size.small);
            y += size.small * 1.3;
          }
        }
        y += 3;
        break;
      case 'row':
        pair(b.label, b.value, b.strong ? size.base * 1.1 : size.base, b.strong);
        break;
      case 'footer':
        rule();
        centered(b.text, size.small);
        break;
    }
  }
  const height = Math.min(canvas.height, Math.ceil(y + 8));
  return ctx.getImageData(0, 0, width, height);
}
