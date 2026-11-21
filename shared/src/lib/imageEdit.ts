import { IMAGE_CROP_MIN_PIXELS, IMAGE_ROTATION_STEP, type ImageRotation } from "@/constants/image";

/** An edit is DATA (crop, turn, mirror) that sharp applies to the original, never a canvas re-encode; pure so editor and server agree. */

/** The crop as fractions (0-1) of the mirrored and turned frame, because Safari caps decoded pixel sizes. */
export interface ImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageEdit {
  /** Null means "the whole frame" — a turn or a mirror with no crop. */
  crop: ImageCrop | null;
  /** Clockwise, in degrees: 0, 90, 180 or 270. */
  rotation: ImageRotation;
  /** Mirrored left-to-right, then top-to-bottom — applied BEFORE the turn. */
  flipHorizontal: boolean;
  flipVertical: boolean;
}

/** Nothing was changed: what a photo uploaded without opening the editor gets. */
export const IDENTITY_IMAGE_EDIT: ImageEdit = {
  crop: null,
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
};

export function isIdentityImageEdit(edit: ImageEdit | null | undefined): boolean {
  if (!edit) {
    return true;
  }
  const untouched = edit.rotation === 0 && !edit.flipHorizontal && !edit.flipVertical;
  const wholeFrame =
    !edit.crop || (edit.crop.x <= 0 && edit.crop.y <= 0 && edit.crop.width >= 1 && edit.crop.height >= 1);
  return untouched && wholeFrame;
}

/** The size of the frame the editor showed, given the file's own dimensions. */
export function rotatedFrameSize(
  size: { width: number; height: number },
  rotation: ImageRotation,
): { width: number; height: number } {
  return rotation === 90 || rotation === 270
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

/** Region of the ORIGINAL file, in its own pixels — sharp's `extract`. */
export interface ImageExtractRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** sharp applies extract, then flop/flip, then rotate whatever the call order, so the crop is mapped into the unturned file. */
export interface ImageEditOps {
  extract: ImageExtractRegion | null;
  flop: boolean;
  flip: boolean;
  rotation: ImageRotation;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Undo mirror-then-turn for one point: turn back, then un-mirror. */
function toOriginalPoint(
  point: { x: number; y: number },
  size: { width: number; height: number },
  edit: ImageEdit,
): { x: number; y: number } {
  const { width: w, height: h } = size;
  let x: number;
  let y: number;

  // The frame is w×h at 0/180 and h×w at 90/270.
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

  // Un-mirror.
  if (edit.flipHorizontal) {
    x = w - x;
  }
  if (edit.flipVertical) {
    y = h - y;
  }

  return { x, y };
}

/** Both crop corners are mapped back and read as a min/max box, which holds for every turn and mirror. */
export function resolveImageEditOps(edit: ImageEdit, size: { width: number; height: number }): ImageEditOps {
  const ops: ImageEditOps = {
    extract: null,
    flop: edit.flipHorizontal,
    flip: edit.flipVertical,
    rotation: edit.rotation,
  };

  if (!edit.crop) {
    return ops;
  }

  const frame = rotatedFrameSize(size, edit.rotation);
  const cropped = {
    left: clamp(edit.crop.x, 0, 1) * frame.width,
    top: clamp(edit.crop.y, 0, 1) * frame.height,
    right: clamp(edit.crop.x + edit.crop.width, 0, 1) * frame.width,
    bottom: clamp(edit.crop.y + edit.crop.height, 0, 1) * frame.height,
  };

  const a = toOriginalPoint({ x: cropped.left, y: cropped.top }, size, edit);
  const b = toOriginalPoint({ x: cropped.right, y: cropped.bottom }, size, edit);

  const left = clamp(Math.round(Math.min(a.x, b.x)), 0, Math.max(0, size.width - IMAGE_CROP_MIN_PIXELS));
  const top = clamp(Math.round(Math.min(a.y, b.y)), 0, Math.max(0, size.height - IMAGE_CROP_MIN_PIXELS));
  const width = clamp(Math.round(Math.abs(b.x - a.x)), IMAGE_CROP_MIN_PIXELS, size.width - left);
  const height = clamp(Math.round(Math.abs(b.y - a.y)), IMAGE_CROP_MIN_PIXELS, size.height - top);

  // A whole-file crop is skipped, so an unedited upload stays byte-identical.
  if (left === 0 && top === 0 && width === size.width && height === size.height) {
    return ops;
  }

  ops.extract = { left, top, width, height };
  return ops;
}

/** The cropper's rectangle needs NO mirror conversion: its blindness to the CSS mirror and the mirrored frame cancel; adding one flips every crop. */

/** Mirroring what the person sees: at 90/270 that means the vertical flag, because a quarter turn swaps the axes. */
export function toggleDisplayFlip(edit: ImageEdit, axis: "horizontal" | "vertical"): ImageEdit {
  const quarterTurned = edit.rotation === 90 || edit.rotation === 270;
  const target: "flipHorizontal" | "flipVertical" =
    (axis === "horizontal") === !quarterTurned ? "flipHorizontal" : "flipVertical";
  return { ...edit, [target]: !edit[target] };
}

/** The next quarter turn clockwise, keeping the value one of the four. */
export function rotateClockwise(rotation: ImageRotation): ImageRotation {
  const next = (rotation + IMAGE_ROTATION_STEP) % 360;
  return next as ImageRotation;
}
