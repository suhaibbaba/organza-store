/**
 * ESC/POS for 80 mm receipt printers (Epson TM-T20/T88 and the many compatibles). Text goes out
 * as a raster image, not as characters: printer code pages rarely have Arabic or Hebrew with
 * proper joining and direction, while a picture prints the same on every model.
 */

const ESC = 0x1b;
const GS = 0x1d;

/** 80 mm paper at 203 dpi prints 72 mm: 576 dots. 58 mm printers use 384. */
export const PAPER_DOTS = { 80: 576, 58: 384 } as const;
export type PaperWidth = keyof typeof PAPER_DOTS;

/** Rows per raster command: small enough for printers with little buffer. */
const BAND = 128;

export const initialize = (): number[] => [ESC, 0x40];

/** Feed `lines` and cut, leaving a little paper attached (partial cut). */
export const feedAndCut = (lines = 4): number[] => [GS, 0x56, 0x42, lines];

/**
 * Opens the cash drawer wired to the printer's RJ11 port: pin 2 (`pin` 0) or pin 5 (1), with a
 * 50 ms on / 500 ms off pulse, which every drawer we know of accepts.
 */
export const drawerKick = (pin: 0 | 1 = 0): number[] => [ESC, 0x70, pin, 25, 250];

/**
 * Turns RGBA pixels into packed 1-bit rows (1 = black). A pixel is black when it is dark enough
 * after its transparency is laid over white paper.
 */
export function toMonochrome(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 160,
): { bytesPerRow: number; bits: Uint8Array } {
  const bytesPerRow = Math.ceil(width / 8);
  const bits = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = rgba[i + 3]! / 255;
      const luma = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
      const onWhite = luma * alpha + 255 * (1 - alpha);
      if (onWhite < threshold) bits[y * bytesPerRow + (x >> 3)]! |= 0x80 >> (x & 7);
    }
  }
  return { bytesPerRow, bits };
}

/** `GS v 0` raster commands for a 1-bit image, cut into bands. Blank rows at the end are trimmed. */
export function raster(bits: Uint8Array, bytesPerRow: number): number[] {
  let height = bits.length / bytesPerRow;
  while (
    height > 0 &&
    bits.subarray((height - 1) * bytesPerRow, height * bytesPerRow).every((b) => b === 0)
  )
    height--;
  const out: number[] = [];
  for (let top = 0; top < height; top += BAND) {
    const rows = Math.min(BAND, height - top);
    out.push(GS, 0x76, 0x30, 0, bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8);
    const band = bits.subarray(top * bytesPerRow, (top + rows) * bytesPerRow);
    for (const b of band) out.push(b);
  }
  return out;
}

/** A whole receipt job: reset, the picture, optionally the drawer, then feed and cut. */
export function receiptJob(
  image: { data: Uint8ClampedArray; width: number; height: number },
  options: { openDrawer?: boolean; drawerPin?: 0 | 1; cut?: boolean } = {},
): Uint8Array {
  const { bytesPerRow, bits } = toMonochrome(image.data, image.width, image.height);
  return Uint8Array.from([
    ...initialize(),
    ...(options.openDrawer ? drawerKick(options.drawerPin) : []),
    ...raster(bits, bytesPerRow),
    ...(options.cut === false ? [] : feedAndCut()),
  ]);
}
