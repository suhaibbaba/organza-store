import {
  IDENTITY_IMAGE_EDIT,
  isIdentityImageEdit,
  rotatedFrameSize,
  resolveImageEditOps,
  type ImageEdit,
} from "@store/shared/lib/imageEdit";
import { CROP_PREVIEW_MAX_PX, EDITOR_SOURCE_MAX_PX } from "@/constants/images";

// Browser-side previews only; the crop arithmetic is shared with the backend.

/** Loads an image element, resolved once it actually has dimensions. */
function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Without it the canvas is tainted; a blob: URL must not carry it, or Safari fails.
    if (crossOrigin) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image failed to load"));
    image.src = src;
  });
}

// Preview only (the stored photo is cut by sharp); returns null rather than throwing, and the edit still saves.
export async function renderCropPreview(
  src: string,
  edit: ImageEdit,
  { crossOrigin = false }: { crossOrigin?: boolean } = {},
): Promise<string | null> {
  try {
    const image = await loadImage(src, crossOrigin);
    const natural = { width: image.naturalWidth, height: image.naturalHeight };
    if (!natural.width || !natural.height) {
      return null;
    }

    const ops = resolveImageEditOps(edit, natural);
    const region = ops.extract ?? { left: 0, top: 0, width: natural.width, height: natural.height };
    // The size the cut piece ends up, once it has been turned.
    const turned = rotatedFrameSize({ width: region.width, height: region.height }, ops.rotation);

    // A full-size canvas of a 12-megapixel photo can run a phone out of memory.
    const scale = Math.min(1, CROP_PREVIEW_MAX_PX / Math.max(turned.width, turned.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(turned.width * scale));
    canvas.height = Math.max(1, Math.round(turned.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    // The server's order (mirror, then turn), so this cannot drift from what is stored.
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
      region.height,
    );

    return await new Promise<string | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null));
    });
  } catch {
    return null;
  }
}

// Saving without moving anything is no edit: no stored crop, no re-cut.
export function editToSend(edit: ImageEdit | null): ImageEdit | null {
  return !edit || isIdentityImageEdit(edit) ? null : edit;
}

/** Where the editor opens: the stored edit, or an untouched photograph. */
export function editOrIdentity(edit: ImageEdit | null | undefined): ImageEdit {
  return edit ?? IDENTITY_IMAGE_EDIT;
}

/** What the editor should actually draw, and whether it owns that URL. */
export interface EditorSource {
  url: string;
  /** True for a URL created here, which the caller has to revoke. */
  owned: boolean;
}

// iOS silently refuses huge decoded images, so the editor gets a scaled copy; each step degrades rather than fails.
export async function loadEditorSource(
  src: string,
  { crossOrigin = false }: { crossOrigin?: boolean } = {},
): Promise<EditorSource | null> {
  let image: HTMLImageElement | null = null;
  try {
    image = await loadImage(src, crossOrigin);
  } catch {
    // Refused for a canvas but still displayable, so ask again the ordinary way.
    if (crossOrigin) {
      try {
        image = await loadImage(src, false);
        return { url: src, owned: false };
      } catch {
        return null;
      }
    }
    return null;
  }

  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longest) {
    return null;
  }
  if (longest <= EDITOR_SOURCE_MAX_PX) {
    return { url: src, owned: false };
  }

  try {
    const scale = EDITOR_SOURCE_MAX_PX / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      return { url: src, owned: false };
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    return blob ? { url: URL.createObjectURL(blob), owned: true } : { url: src, owned: false };
  } catch {
    return { url: src, owned: false };
  }
}
