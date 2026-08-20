import {
  IDENTITY_IMAGE_EDIT,
  isIdentityImageEdit,
  rotatedFrameSize,
  resolveImageEditOps,
  type ImageEdit,
} from "@organza/shared/lib/imageEdit";
import { CROP_PREVIEW_MAX_PX } from "@/constants/images";

// The editor's browser-side helpers. The arithmetic itself is shared with the
// backend (@organza/shared/lib/imageEdit), so the crop drawn here and the crop
// cut there are the same crop by construction; what lives in this file is the
// part only a browser can do — draw the preview the gallery shows while the
// real picture is still waiting to be cut on the server.

/** Loads an image element, resolved once it actually has dimensions. */
function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Only for a photo already on the API host: without this the canvas below
    // is tainted and refuses to hand back a preview. A blob: URL is
    // same-origin and must NOT carry it — Safari fails such a request.
    if (crossOrigin) image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed to load"));
    image.src = src;
  });
}

/**
 * A PREVIEW of the edit — and only ever a preview.
 *
 * The picture that gets stored is cut by sharp, from the original, on the
 * server (CLAUDE.md: images optimized with sharp on upload). What this draws
 * is the same rectangle at thumbnail size so the gallery can show what was
 * framed without a round trip: a canvas re-encode is fine for a 300px tile
 * and would be vandalism as the stored photograph, since it has already lost
 * the detail the crop was made to keep.
 *
 * Returns null rather than throwing. A preview is a courtesy — if the browser
 * will not produce one (a cross-origin photo the API did not allow, an
 * out-of-memory canvas on an old phone), the gallery falls back to the
 * thumbnail it already has and the edit is still saved exactly as drawn.
 */
export async function renderCropPreview(
  src: string,
  edit: ImageEdit,
  { crossOrigin = false }: { crossOrigin?: boolean } = {}
): Promise<string | null> {
  try {
    const image = await loadImage(src, crossOrigin);
    const natural = { width: image.naturalWidth, height: image.naturalHeight };
    if (!natural.width || !natural.height) return null;

    const ops = resolveImageEditOps(edit, natural);
    const region = ops.extract ?? { left: 0, top: 0, width: natural.width, height: natural.height };
    // The size the cut piece ends up, once it has been turned.
    const turned = rotatedFrameSize({ width: region.width, height: region.height }, ops.rotation);

    // Capped: this is a tile in a grid, and a full-resolution canvas of a
    // 12-megapixel photograph is how a phone runs out of memory mid-form.
    const scale = Math.min(1, CROP_PREVIEW_MAX_PX / Math.max(turned.width, turned.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(turned.width * scale));
    canvas.height = Math.max(1, Math.round(turned.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;

    // The same order the server works in — mirror, then turn — with the crop
    // already resolved into the file's own coordinates by the shared
    // geometry, so this cannot drift from what will be stored.
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((ops.rotation * Math.PI) / 180);
    context.scale(ops.flop ? -scale : scale, ops.flip ? -scale : scale);
    context.drawImage(
      image,
      region.left,
      region.top,
      region.width,
      region.height,
      -region.width / 2,
      -region.height / 2,
      region.width,
      region.height
    );

    return await new Promise<string | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null));
    });
  } catch {
    return null;
  }
}

/**
 * What a gallery actually keeps from a pass through the editor.
 *
 * Somebody who opens the editor, looks, and saves without moving anything has
 * changed nothing — and that must not become a stored crop, a re-cut of a
 * photograph on the server, or a Save that reports work it did not do.
 */
export function editToSend(edit: ImageEdit | null): ImageEdit | null {
  return !edit || isIdentityImageEdit(edit) ? null : edit;
}

/** Where the editor opens: the stored edit, or an untouched photograph. */
export function editOrIdentity(edit: ImageEdit | null | undefined): ImageEdit {
  return edit ?? IDENTITY_IMAGE_EDIT;
}
