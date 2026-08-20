import { IMAGE_CROP_MIN_PIXELS, IMAGE_ROTATION_STEP, type ImageRotation } from "@/constants/image";

/**
 * WHAT THE SHOP DID TO A PHOTOGRAPH — and how sharp is told to do it.
 *
 * The admin's editor never writes an image. It sends what the person on the
 * counter chose — a rectangle, a quarter turn, a mirror — and the backend
 * cuts THAT out of the file they uploaded, at full quality (CLAUDE.md:
 * optimized with sharp on upload). A canvas re-encode in the browser would
 * hand the server a picture that had already been decoded, resized to
 * whatever fits a phone screen, and re-compressed once — every one of those
 * steps costing detail that no amount of care afterwards puts back.
 *
 * So an edit is DATA, and this file is the one place that knows how to read
 * it. It is pure arithmetic on purpose: no sharp, no canvas, no DOM. Both
 * ends import it, which is the only way the picture the editor drew and the
 * picture the server cut can be guaranteed to be the same picture.
 */

/**
 * The crop rectangle, as FRACTIONS (0–1) of the frame the person was looking
 * at — that is, of the photo after it has been mirrored and turned.
 *
 * Fractions rather than pixels because the browser is not a trustworthy
 * source of pixel dimensions: it reports the decoded size, which Safari
 * quietly caps on very large photographs. A fraction of a frame is the same
 * fraction whatever the file turns out to hold.
 */
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
  if (!edit) return true;
  const untouched = edit.rotation === 0 && !edit.flipHorizontal && !edit.flipVertical;
  const wholeFrame =
    !edit.crop ||
    (edit.crop.x <= 0 && edit.crop.y <= 0 && edit.crop.width >= 1 && edit.crop.height >= 1);
  return untouched && wholeFrame;
}

/** The size of the frame the editor showed, given the file's own dimensions. */
export function rotatedFrameSize(
  size: { width: number; height: number },
  rotation: ImageRotation
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

/**
 * Everything sharp needs, in the order sharp actually applies it.
 *
 * sharp has a FIXED pipeline order regardless of the order the calls are
 * chained in — measured, not assumed: `extract` first, then `flop`/`flip`,
 * then `rotate`. That is why the crop below is mapped back into the original
 * file's coordinates rather than handed over as the editor's own rectangle:
 * extract happens before the picture is turned, so it has to be expressed in
 * the picture's unturned coordinates.
 *
 * Cropping first and turning afterwards is also the cheap way round — sharp
 * rotates only the part being kept — and, for the same crop, gives exactly
 * the same pixels as turning first and cropping after, because a quarter turn
 * and a mirror both map an axis-aligned rectangle onto an axis-aligned
 * rectangle.
 */
export interface ImageEditOps {
  extract: ImageExtractRegion | null;
  flop: boolean;
  flip: boolean;
  rotation: ImageRotation;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Undo the mirror-then-turn for ONE point: from the frame the person cropped
 * in, back to a position in the file as it was uploaded.
 *
 * The forward transform is "mirror, then turn clockwise", which is what both
 * the editor's CSS and sharp do. Inverting it is: turn back, then un-mirror
 * (a mirror is its own inverse).
 */
function toOriginalPoint(
  point: { x: number; y: number },
  size: { width: number; height: number },
  edit: ImageEdit
): { x: number; y: number } {
  const { width: w, height: h } = size;
  let x: number;
  let y: number;

  // Turn back. The frame is w×h for 0/180 and h×w for 90/270, so each case
  // reads its coordinates from the frame it actually came from.
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
  if (edit.flipHorizontal) x = w - x;
  if (edit.flipVertical) y = h - y;

  return { x, y };
}

/**
 * The edit, resolved against a real file's dimensions.
 *
 * Both corners of the crop are mapped back individually and then read as a
 * min/max box, rather than the origin being mapped and the width/height being
 * swapped by hand — same answer, and it stays right for every combination of
 * turn and mirror without four more branches to get wrong.
 */
export function resolveImageEditOps(
  edit: ImageEdit,
  size: { width: number; height: number }
): ImageEditOps {
  const ops: ImageEditOps = {
    extract: null,
    flop: edit.flipHorizontal,
    flip: edit.flipVertical,
    rotation: edit.rotation,
  };

  if (!edit.crop) return ops;

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

  // A crop that covers the whole file is not a crop; skipping it saves sharp
  // a pass and keeps "uploaded without editing" byte-identical to what it
  // was before any of this existed.
  if (left === 0 && top === 0 && width === size.width && height === size.height) return ops;

  ops.extract = { left, top, width, height };
  return ops;
}

/**
 * WHY THE CROP NEEDS NO CONVERSION, THOUGH IT LOOKS AS IF IT SHOULD.
 *
 * The editor mirrors the photograph with a CSS transform, and the cropper's
 * own arithmetic is blind to it: it computes the reported rectangle from the
 * crop offset, the zoom, the turn and the media's size, and nothing else. So
 * the rectangle it hands back names a region of the UNMIRRORED picture — not
 * the region the person was looking at.
 *
 * The rectangle the server needs, meanwhile, is expressed in the MIRRORED
 * frame (that is what `crop` means above).
 *
 * Those are two reflections, about the same axis through the same centre —
 * the media's own, which is where a CSS transform-origin sits — and they
 * cancel. Written out: the cropper reports R = {p : T(p) inside the box},
 * where T is the transform it thinks is applied; the picture on screen is
 * T(M(p)) with M the mirror, so what the person sees is M(R) in unmirrored
 * coordinates; and re-expressing M(R) in the mirrored frame applies M once
 * more, giving R back. The same holds at every quarter turn, because turning
 * conjugates the mirror into another mirror about the same centre.
 *
 * Hence: what the cropper reports is stored as-is, and what is stored is fed
 * straight back to the cropper when the editor re-opens. This note is here
 * because the cancellation is invisible in the code — the natural instinct on
 * reading it is that a conversion is missing, and adding one would mirror
 * every cropped photograph the wrong way round.
 */

/**
 * "Mirror what I am looking at" — as the shop means it — in terms of the
 * stored edit, which mirrors the photograph BEFORE turning it (the order
 * sharp works in).
 *
 * At 0° and 180° the two are the same thing. At 90° and 270° they are the
 * other way round: the button that mirrors the picture left-to-right on
 * screen has to set the vertical mirror, because a quarter turn has already
 * swapped the axes. Getting this wrong is not a crash — it is a photograph
 * that mirrors the wrong way when somebody has already turned it, which is
 * the sort of thing that gets noticed at the counter and never reported.
 */
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
