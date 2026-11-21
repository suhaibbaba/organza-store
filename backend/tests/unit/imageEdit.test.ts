// The server's cut must match the editor's frame: checked against a per-pixel reference over every turn, mirror and crop.
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { resolveImageEditOps, type ImageEdit } from "@store/shared/lib/imageEdit";
import { IMAGE_ROTATIONS } from "@store/shared/constants/image";
import { editedImage } from "@/lib/image";

// Portrait and not square, since a square hides exactly these bugs; small so failures print readably.
const WIDTH = 8;
const HEIGHT = 12;

/** A pixel that says where it came from: red carries x, green carries y. */
const CHANNEL_STEP = 20;

function sourceImage(): Promise<Buffer> {
  const raw = Buffer.alloc(WIDTH * HEIGHT * 3);
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const i = (y * WIDTH + x) * 3;
      raw[i] = x * CHANNEL_STEP;
      raw[i + 1] = y * CHANNEL_STEP;
      raw[i + 2] = 100;
    }
  }
  return sharp(raw, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
    .png()
    .toBuffer();
}

function frameSize(rotation: number): { width: number; height: number } {
  return rotation === 90 || rotation === 270 ? { width: HEIGHT, height: WIDTH } : { width: WIDTH, height: HEIGHT };
}

/** The reference: the inverse lookup the browser preview draws, i.e. what the shop is looking at. */
function referenceFrame(edit: ImageEdit): string[][] {
  const frame = frameSize(edit.rotation);
  const rows: string[][] = [];
  for (let fy = 0; fy < frame.height; fy += 1) {
    const row: string[] = [];
    for (let fx = 0; fx < frame.width; fx += 1) {
      let mx: number;
      let my: number;
      if (edit.rotation === 90) {
        mx = fy;
        my = HEIGHT - 1 - fx;
      } else if (edit.rotation === 180) {
        mx = WIDTH - 1 - fx;
        my = HEIGHT - 1 - fy;
      } else if (edit.rotation === 270) {
        mx = WIDTH - 1 - fy;
        my = fx;
      } else {
        mx = fx;
        my = fy;
      }
      const sx = edit.flipHorizontal ? WIDTH - 1 - mx : mx;
      const sy = edit.flipVertical ? HEIGHT - 1 - my : my;
      row.push(`${sx},${sy}`);
    }
    rows.push(row);
  }
  return rows;
}

/** The frame, cut down to the crop the editor sent. */
function croppedReference(edit: ImageEdit): string[][] {
  const frame = referenceFrame(edit);
  if (!edit.crop) {
    return frame;
  }
  const size = frameSize(edit.rotation);
  const top = Math.round(edit.crop.y * size.height);
  const left = Math.round(edit.crop.x * size.width);
  return frame
    .slice(top, top + Math.round(edit.crop.height * size.height))
    .map((row) => row.slice(left, left + Math.round(edit.crop!.width * size.width)));
}

/** The API's own pipeline (editedImage), not a copy: sharp's ordering rules would let a copy pass while the real one failed. */
async function serverResult(edit: ImageEdit): Promise<string[][]> {
  const ops = resolveImageEditOps(edit, { width: WIDTH, height: HEIGHT });
  const { data, info } = await editedImage(await sourceImage(), ops, 1600)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rows: string[][] = [];
  for (let y = 0; y < info.height; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * info.channels;
      row.push(`${data[i] / CHANNEL_STEP},${data[i + 1] / CHANNEL_STEP}`);
    }
    rows.push(row);
  }
  return rows;
}

describe("Image edits (crop, turn, mirror)", () => {
  for (const rotation of IMAGE_ROTATIONS) {
    for (const flipHorizontal of [false, true]) {
      for (const flipVertical of [false, true]) {
        const frame = frameSize(rotation);
        const cases: { label: string; crop: ImageEdit["crop"] }[] = [
          { label: "whole frame", crop: null },
          {
            label: "2:3 crop in the middle",
            crop: { x: 2 / frame.width, y: 3 / frame.height, width: 4 / frame.width, height: 6 / frame.height },
          },
          {
            // An RTL layout's starting corner is still the frame's origin: the crop is geometry, not reading order.
            label: "2:3 crop at the origin",
            crop: { x: 0, y: 0, width: 2 / frame.width, height: 3 / frame.height },
          },
        ];

        for (const { label, crop } of cases) {
          it(`cuts ${label} at ${rotation}° (mirror ${flipHorizontal ? "h" : "-"}${flipVertical ? "v" : "-"}) exactly as the editor drew it`, async () => {
            const edit: ImageEdit = { crop, rotation, flipHorizontal, flipVertical };
            expect(await serverResult(edit)).toEqual(croppedReference(edit));
          });
        }
      }
    }
  }

  it("leaves a photo uploaded without editing completely alone", () => {
    const ops = resolveImageEditOps(
      { crop: { x: 0, y: 0, width: 1, height: 1 }, rotation: 0, flipHorizontal: false, flipVertical: false },
      { width: WIDTH, height: HEIGHT },
    );
    // No extract, mirror or turn, so an unedited upload is unchanged.
    expect(ops).toEqual({ extract: null, flop: false, flip: false, rotation: 0 });
  });

  it("never asks sharp for a region outside the file", () => {
    // A full-frame crop at every turn must stay inside the original, or sharp throws and a fine photo is a 500.
    for (const rotation of IMAGE_ROTATIONS) {
      const ops = resolveImageEditOps(
        { crop: { x: 0.5, y: 0.5, width: 0.5, height: 0.5 }, rotation, flipHorizontal: true, flipVertical: true },
        { width: WIDTH, height: HEIGHT },
      );
      expect(ops.extract).not.toBeNull();
      expect(ops.extract!.left + ops.extract!.width).toBeLessThanOrEqual(WIDTH);
      expect(ops.extract!.top + ops.extract!.height).toBeLessThanOrEqual(HEIGHT);
    }
  });
});
