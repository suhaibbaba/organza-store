"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import { Button, Spinner } from "@store/ui";
import { Check, FlipHorizontal2, FlipVertical2, RotateCw, X } from "lucide-react";
import {
  IMAGE_ZOOM,
  PRODUCT_IMAGE_ASPECT,
  PRODUCT_IMAGE_ASPECT_RATIO,
} from "@organza/shared/constants/image";
import {
  rotateClockwise,
  rotatedFrameSize,
  toggleDisplayFlip,
  type ImageCrop,
  type ImageEdit,
} from "@organza/shared/lib/imageEdit";
import { CROP_ZOOM_KEY_STEP } from "@/constants/images";
import { loadEditorSource } from "@/lib/image-edit";
import { cn } from "@/lib/utils";

interface ImageEditorSheetProps {
  /** The photograph to frame: a picked file's blob URL, or a stored original. */
  src: string;
  /** Whether `src` is on the API host — it decides how it can be read. */
  crossOrigin?: boolean;
  /** The stored original, tried only if `src` (the optimizer's copy) fails, so a broken optimizer makes the editor slow, not unusable. */
  fallbackSrc?: string;
  /** Where to open — the edit this photo already carries, or an untouched one. */
  edit: ImageEdit;
  /** "2 of 3" while working through a batch; absent for a single photo. */
  step?: { index: number; total: number } | null;
  onCancel: () => void;
  onSave: (edit: ImageEdit) => void;
}

/** Only numbers leave here (crop, turn, mirror) — sharp cuts the original at full quality, never a canvas re-encode (spec.md "Editing a photograph on upload"). */
export function ImageEditorSheet({
  src,
  crossOrigin = false,
  fallbackSrc,
  edit,
  step,
  onCancel,
  onSave,
}: ImageEditorSheetProps) {
  const t = useTranslations("products.form.images.editor");

  // `crop` is the cropper's pixel offset; what we keep is the AREA it reports, in fractions.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(IMAGE_ZOOM.min);
  const [working, setWorking] = useState<ImageEdit>(edit);
  const [area, setArea] = useState<ImageCrop | null>(edit.crop);
  // On = the catalogue's 2:3; off = the photograph's own shape.
  const [constrained, setConstrained] = useState(true);
  // The picture as DRAWN (fitted size), needed for the whole-photo box shape and zoom.
  const [drawnSize, setDrawnSize] = useState<{ width: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // `src` scaled down to something a phone reliably decodes; "failed" must never be swallowed.
  const [source, setSource] = useState<{ url: string } | "failed" | null>(null);

  useEffect(() => {
    let cancelled = false;
    let owned: string | null = null;

    void loadEditorSource(src, { crossOrigin })
      .then((result) => result ?? (fallbackSrc ? loadEditorSource(fallbackSrc, { crossOrigin: true }) : null))
      .then((result) => {
        if (cancelled) {
          if (result?.owned) URL.revokeObjectURL(result.url);
          return;
        }
        if (!result) {
          setSource("failed");
          return;
        }
        if (result.owned) owned = result.url;
        setSource({ url: result.url });
      });

    return () => {
      cancelled = true;
      if (owned) URL.revokeObjectURL(owned);
    };
  }, [src, crossOrigin, fallbackSrc]);

  // Nothing resets on a photo change: the gallery mounts one editor per photo (key={target.id}).

  /** Zoom at which the box covers the ENTIRE photo — not 1 for a turned picture; mirrors the cropper's getCropSize. */
  const wholePhotoZoom = useCallback(
    (rotation: ImageEdit["rotation"]): number => {
      const frame = canvasRef.current?.getBoundingClientRect();
      if (!frame || !drawnSize) return IMAGE_ZOOM.min;
      const picture = rotatedFrameSize(drawnSize, rotation);
      const aspect = picture.width / picture.height;
      const fittingWidth = Math.min(picture.width, frame.width);
      const fittingHeight = Math.min(picture.height, frame.height);
      const boxWidth = fittingWidth > fittingHeight * aspect ? fittingHeight * aspect : fittingWidth;
      // Never above 1: the box already holds everything there.
      return Math.min(IMAGE_ZOOM.min, boxWidth / picture.width);
    },
    [drawnSize]
  );

  const handleCropComplete = useCallback((percentages: Area) => {
    // Deliberately not converted for the mirror — see "WHY THE CROP NEEDS NO CONVERSION" in shared/lib/imageEdit.
    setArea({
      x: percentages.x / 100,
      y: percentages.y / 100,
      width: percentages.width / 100,
      height: percentages.height / 100,
    });
  }, []);

  // A portrait photo turned a quarter is a landscape frame.
  const drawnFrame = drawnSize ? rotatedFrameSize(drawnSize, working.rotation) : null;
  const wholeFrameAspect = drawnFrame ? drawnFrame.width / drawnFrame.height : PRODUCT_IMAGE_ASPECT_RATIO;

  return (
    // Full screen, not a Drawer: a side panel is the wrong shape for a portrait photo and invites a tap that loses the crop.
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      data-test-selector="image-editor"
      // Pinch-zoom is cancelled app-wide (globals.css) except here, where it IS the feature.
      data-allow-zoom="true"
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-[calc(var(--safe-top)+0.5rem)] text-ink-inverse">
        {/* In a batch this skips (keeps the photo as is), so it says "skip", not "cancel". */}
        <button
          type="button"
          onClick={onCancel}
          aria-label={step && step.total > 1 ? t("skip") : t("cancel")}
          data-test-selector="image-editor-cancel"
          className="inline-flex size-11 items-center justify-center rounded-pill text-ink-inverse/90 transition-colors hover:bg-ink-inverse/10"
        >
          <X className="size-6" aria-hidden="true" />
        </button>

        <p className="min-w-0 truncate text-sm font-medium" data-test-selector="image-editor-step">
          {step && step.total > 1 ? t("step", { index: step.index, total: step.total }) : t("title")}
        </p>

        <button
          type="button"
          onClick={() => onSave({ ...working, crop: area })}
          aria-label={t("save")}
          data-test-selector="image-editor-save"
          disabled={source === null || source === "failed"}
          className="inline-flex size-11 items-center justify-center rounded-pill text-ink-inverse transition-colors hover:bg-ink-inverse/10 disabled:opacity-40"
        >
          <Check className="size-6" aria-hidden="true" />
        </button>
      </div>

      {/* `relative`: the cropper positions itself absolutely. */}
      <div ref={canvasRef} className="relative min-h-0 flex-1" data-test-selector="image-editor-canvas">
        {source === null && (
          <div className="absolute inset-0 flex items-center justify-center" data-test-selector="image-editor-loading">
            <Spinner className="size-8 text-ink-inverse" />
          </div>
        )}

        {source === "failed" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center"
            data-test-selector="image-editor-failed"
          >
            <p className="text-base font-medium text-ink-inverse">{t("failed")}</p>
            <p className="text-sm text-ink-inverse/70">{t("failedHint")}</p>
          </div>
        )}

        {source !== null && source !== "failed" && (
        <Cropper
          image={source.url}
          crop={offset}
          zoom={zoom}
          rotation={working.rotation}
          aspect={constrained ? PRODUCT_IMAGE_ASPECT_RATIO : wholeFrameAspect}
          // The cropper refuses a zoom under its minimum, so the floor moves with the whole-photo zoom.
          minZoom={constrained ? IMAGE_ZOOM.min : Math.min(IMAGE_ZOOM.min, zoom)}
          maxZoom={IMAGE_ZOOM.max}
          objectFit="contain"
          showGrid
          initialCroppedAreaPercentages={
            edit.crop
              ? {
                  x: edit.crop.x * 100,
                  y: edit.crop.y * 100,
                  width: edit.crop.width * 100,
                  height: edit.crop.height * 100,
                }
              : undefined
          }
          onMediaLoaded={(size: MediaSize) => setDrawnSize({ width: size.width, height: size.height })}
          onCropChange={setOffset}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
          // Mirror before the turn, the same order sharp uses, so preview and stored photo match.
          transform={[
            `translate(${offset.x}px, ${offset.y}px)`,
            `rotate(${working.rotation}deg)`,
            `rotateY(${working.flipHorizontal ? 180 : 0}deg)`,
            `rotateX(${working.flipVertical ? 180 : 0}deg)`,
            `scale(${zoom})`,
          ].join(" ")}
        />
        )}
      </div>

      <div
        className={cn(
          "flex flex-col gap-4 px-4 pb-[calc(var(--safe-bottom)+1rem)] pt-4 text-ink-inverse",
          // No controls until a picture is on screen: saving a crop nobody saw is worse than a wait.
          source === null || source === "failed" ? "pointer-events-none opacity-40" : ""
        )}
      >
        <label className="flex items-center gap-3">
          <span className="sr-only">{t("zoom")}</span>
          <input
            type="range"
            min={constrained ? IMAGE_ZOOM.min : Math.min(IMAGE_ZOOM.min, zoom)}
            max={IMAGE_ZOOM.max}
            step={CROP_ZOOM_KEY_STEP}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label={t("zoom")}
            data-test-selector="image-editor-zoom"
            className="h-11 w-full accent-ink-inverse"
          />
        </label>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <EditorAction
            icon={<RotateCw className="size-5" aria-hidden="true" />}
            label={t("rotate")}
            name="rotate"
            onClick={() =>
              setWorking((current) => {
                const rotation = rotateClockwise(current.rotation);
                // A turn changes the whole-photo zoom too.
                if (!constrained) setZoom(wholePhotoZoom(rotation));
                return { ...current, rotation };
              })
            }
          />
          <EditorAction
            icon={<FlipHorizontal2 className="size-5" aria-hidden="true" />}
            label={t("flipHorizontal")}
            name="flip-horizontal"
            // Mirrors what is SEEN; the axis mapping lives in shared so both apps and the server agree.
            onClick={() => setWorking((current) => toggleDisplayFlip(current, "horizontal"))}
          />
          <EditorAction
            icon={<FlipVertical2 className="size-5" aria-hidden="true" />}
            label={t("flipVertical")}
            name="flip-vertical"
            onClick={() => setWorking((current) => toggleDisplayFlip(current, "vertical"))}
          />
        </div>

        <div className="flex items-center justify-center gap-2">
          <ShapeChoice
            label={t("aspectCatalogue", { width: PRODUCT_IMAGE_ASPECT.width, height: PRODUCT_IMAGE_ASPECT.height })}
            name="catalogue"
            isActive={constrained}
            onClick={() => {
              setConstrained(true);
              setZoom(IMAGE_ZOOM.min);
              setOffset({ x: 0, y: 0 });
            }}
          />
          <ShapeChoice
            label={t("aspectWhole")}
            name="whole"
            isActive={!constrained}
            onClick={() => {
              // Whole picture: the reported crop resolves to no cut, same as an upload without the editor.
              setConstrained(false);
              setZoom(wholePhotoZoom(working.rotation));
              setOffset({ x: 0, y: 0 });
            }}
          />
        </div>

        <Button
          onClick={() => onSave({ ...working, crop: area })}
          className="w-full"
          data-test-selector="image-editor-done"
        >
          {step && step.total > 1 && step.index < step.total ? t("saveAndNext") : t("saveAndClose")}
        </Button>
      </div>
    </div>
  );
}

function EditorAction({
  icon,
  label,
  name,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-test-selector={`image-editor-${name}`}
      // Labels always drawn: no tooltip on a phone, and the users are not tech-savvy.
      className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-ink-inverse/10 px-3 text-xs font-medium text-ink-inverse transition-colors hover:bg-ink-inverse/20"
    >
      {icon}
      {label}
    </button>
  );
}

function ShapeChoice({
  label,
  name,
  isActive,
  onClick,
}: {
  label: string;
  name: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      data-test-selector={`image-editor-aspect-${name}`}
      className={cn(
        "inline-flex min-h-11 items-center rounded-pill px-4 text-sm font-medium transition-colors",
        isActive ? "bg-surface text-ink" : "bg-ink-inverse/10 text-ink-inverse hover:bg-ink-inverse/20"
      )}
    >
      {label}
    </button>
  );
}
