import { describe, expect, it } from 'vitest';
import { drawerKick, raster, receiptJob, toMonochrome } from './escpos';

/** RGBA for a width × height image where `black(x, y)` decides each pixel. */
function image(width: number, height: number, black: (x: number, y: number) => boolean) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = black(x, y) ? 0 : 255;
      data.set([v, v, v, 255], i);
    }
  return { data, width, height };
}

describe('ESC/POS', () => {
  it('packs pixels into bits, most significant first, padding the row to whole bytes', () => {
    const img = image(10, 1, (x) => x === 0 || x === 9);
    const { bytesPerRow, bits } = toMonochrome(img.data, img.width, img.height);
    expect(bytesPerRow).toBe(2);
    expect([...bits]).toEqual([0b1000_0000, 0b0100_0000]);
  });

  it('treats transparent pixels as white paper', () => {
    const data = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 255]);
    expect([...toMonochrome(data, 2, 1).bits]).toEqual([0b0100_0000]);
  });

  it('writes GS v 0 bands with little-endian sizes and trims blank rows at the end', () => {
    const bits = new Uint8Array([0xff, 0x00, 0x00, 0x00]); // 2 bytes per row, row 2 blank
    expect(raster(bits, 2)).toEqual([0x1d, 0x76, 0x30, 0, 2, 0, 1, 0, 0xff, 0x00]);
  });

  it('splits tall images into bands of 128 rows', () => {
    const bits = new Uint8Array(300).fill(0x01); // 1 byte per row, 300 rows
    const out = raster(bits, 1);
    const heads = out.flatMap((b, i) => (b === 0x1d && out[i + 1] === 0x76 ? [out[i + 6]] : []));
    expect(heads).toEqual([128, 128, 44]);
  });

  it('a job resets the printer, kicks the drawer when asked, prints and cuts', () => {
    const job = [
      ...receiptJob(
        image(8, 1, () => true),
        { openDrawer: true },
      ),
    ];
    expect(job.slice(0, 2)).toEqual([0x1b, 0x40]);
    expect(job.slice(2, 7)).toEqual(drawerKick());
    expect(job.slice(-4)).toEqual([0x1d, 0x56, 0x42, 4]);
    expect(job).toContain(0xff);
  });
});
