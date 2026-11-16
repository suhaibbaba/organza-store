import { z } from 'zod';

/**
 * Photo edit geometry, ported from the current system. The crop is in fractions of the frame as
 * the person saw it (after rotation); the server maps it back onto the original pixels.
 */
export const IMAGE_ROTATIONS = [0, 90, 180, 270] as const;
export type ImageRotation = (typeof IMAGE_ROTATIONS)[number];
export const IMAGE_CROP_MIN_PIXELS = 16;
/** Product photos are framed portrait 2:3. */
export const PRODUCT_IMAGE_ASPECT = 2 / 3;

const fraction = z.number().min(0).max(1);
export const imageEditSchema = z.object({
  crop: z
    .object({ x: fraction, y: fraction, width: fraction, height: fraction })
    .nullable()
    .default(null),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  flipHorizontal: z.boolean().default(false),
  flipVertical: z.boolean().default(false),
});
export type ImageEdit = z.output<typeof imageEditSchema>;

export const IDENTITY_IMAGE_EDIT: ImageEdit = {
  crop: null,
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
};

export interface ImageEditOps {
  extract: { left: number; top: number; width: number; height: number } | null;
  flop: boolean;
  flip: boolean;
  rotation: ImageRotation;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function rotatedFrameSize(size: { width: number; height: number }, rotation: ImageRotation) {
  return rotation === 90 || rotation === 270
    ? { width: size.height, height: size.width }
    : { ...size };
}

function toOriginalPoint(
  point: { x: number; y: number },
  size: { width: number; height: number },
  edit: ImageEdit,
) {
  const { width: w, height: h } = size;
  let x: number;
  let y: number;
  switch (edit.rotation) {
    case 90:
      x = point.y;
      y = h - point.x;
      break;
    case 180:
      x = w - point.x;
      y = h - point.y;
      break;
    case 270:
      x = w - point.y;
      y = point.x;
      break;
    default:
      x = point.x;
      y = point.y;
  }
  if (edit.flipHorizontal) x = w - x;
  if (edit.flipVertical) y = h - y;
  return { x, y };
}

/** Turns an edit into sharp operations against an image of `size` (already upright). */
export function resolveImageEditOps(
  edit: ImageEdit,
  size: { width: number; height: number },
): ImageEditOps {
  const ops: ImageEditOps = {
    extract: null,
    flop: edit.flipHorizontal,
    flip: edit.flipVertical,
    rotation: edit.rotation,
  };
  if (!edit.crop) return ops;
  const frame = rotatedFrameSize(size, edit.rotation);
  const a = toOriginalPoint(
    { x: clamp(edit.crop.x, 0, 1) * frame.width, y: clamp(edit.crop.y, 0, 1) * frame.height },
    size,
    edit,
  );
  const b = toOriginalPoint(
    {
      x: clamp(edit.crop.x + edit.crop.width, 0, 1) * frame.width,
      y: clamp(edit.crop.y + edit.crop.height, 0, 1) * frame.height,
    },
    size,
    edit,
  );
  const left = clamp(
    Math.round(Math.min(a.x, b.x)),
    0,
    Math.max(0, size.width - IMAGE_CROP_MIN_PIXELS),
  );
  const top = clamp(
    Math.round(Math.min(a.y, b.y)),
    0,
    Math.max(0, size.height - IMAGE_CROP_MIN_PIXELS),
  );
  const width = clamp(Math.round(Math.abs(b.x - a.x)), IMAGE_CROP_MIN_PIXELS, size.width - left);
  const height = clamp(Math.round(Math.abs(b.y - a.y)), IMAGE_CROP_MIN_PIXELS, size.height - top);
  if (left === 0 && top === 0 && width === size.width && height === size.height) return ops;
  ops.extract = { left, top, width, height };
  return ops;
}

export function rotateClockwise(rotation: ImageRotation): ImageRotation {
  return ((rotation + 90) % 360) as ImageRotation;
}

/** Flips along the axis as displayed, whatever the current quarter turn. */
export function toggleDisplayFlip(edit: ImageEdit, axis: 'horizontal' | 'vertical'): ImageEdit {
  const quarter = edit.rotation === 90 || edit.rotation === 270;
  const key = (axis === 'horizontal') === !quarter ? 'flipHorizontal' : 'flipVertical';
  return { ...edit, [key]: !edit[key] };
}

/** A marker colour that reads on a photo of this brightness (0 dark … 100 light). */
export function suggestedMarkerColors(brightness: number | null): {
  text: string;
  background: string;
} {
  if (brightness === null) return { text: '#ffffff', background: '#5b2a4d' };
  return brightness < 50
    ? { text: '#1a1a1a', background: '#ffffff' }
    : { text: '#ffffff', background: '#1a1a1a' };
}
