"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import { Button, Spinner } from "@store/ui";
import { FlipHorizontal2, FlipVertical2, RotateCw, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  IMAGE_ZOOM,
  PRODUCT_IMAGE_ASPECT,
  PRODUCT_IMAGE_ASPECT_RATIO,
} from "@store/shared/constants/image";
import {
  rotateClockwise,
  rotatedFrameSize,
  toggleDisplayFlip,
  type ImageCrop,
  type ImageEdit,
} from "@store/shared/lib/imageEdit";
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

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(IMAGE_ZOOM.min);
  const [working, setWorking] = useState<ImageEdit>(edit);
  const [area, setArea] = useState<ImageCrop | null>(edit.crop);
  const [constrained, setConstrained] = useState(true);
  const [drawnSize, setDrawnSize] = useState<{ width: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
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
      return Math.min(IMAGE_ZOOM.min, boxWidth / picture.width);
    },
    [drawnSize]
  );

  const handleCropComplete = useCallback((percentages: Area) => {
    setArea({
      x: percentages.x / 100,
      y: percentages.y / 100,
      width: percentages.width / 100,
      height: percentages.height / 100,
    });
  }, []);

  const drawnFrame = drawnSize ? rotatedFrameSize(drawnSize, working.rotation) : null;
  const wholeFrameAspect = drawnFrame ? drawnFrame.width / drawnFrame.height : PRODUCT_IMAGE_ASPECT_RATIO;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      data-test-selector="image-editor"
      data-allow-zoom="true"
    >
      <div className="flex items-center justify-between gap-2 px-2 pt-[calc(var(--safe-top)+0.5rem)] text-ink-inverse">
        <button
          type="button"
          onClick={onCancel}
          aria-label={step && step.total > 1 ? t("skip") : t("cancel")}
          data-test-selector="image-editor-cancel"
          className="inline-flex size-11 items-center justify-center rounded-pill text-ink-inverse/90 transition-colors hover:bg-ink-inverse/10 focus-visible:bg-ink-inverse/25"
        >
          <X className="size-6" aria-hidden="true" />
        </button>

        <p className="min-w-0 truncate text-sm font-medium" data-test-selector="image-editor-step">
          {step && step.total > 1 ? t("step", { index: step.index, total: step.total }) : t("title")}
        </p>

        <span aria-hidden="true" className="size-11" />
      </div>

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
          "mx-auto flex w-full max-w-xl flex-col gap-4 px-4 pb-[calc(var(--safe-bottom)+1rem)] pt-4 text-ink-inverse",
          source === null || source === "failed" ? "pointer-events-none opacity-40" : ""
        )}
      >
        <label className="flex items-center gap-3">
          <span className="sr-only">{t("zoom")}</span>
          <ZoomOut className="size-4 shrink-0 text-ink-inverse/70" aria-hidden="true" />
          <input
            type="range"
            min={constrained ? IMAGE_ZOOM.min : Math.min(IMAGE_ZOOM.min, zoom)}
            max={IMAGE_ZOOM.max}
            step={CROP_ZOOM_KEY_STEP}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label={t("zoom")}
            data-test-selector="image-editor-zoom"
            className="h-11 w-full cursor-pointer accent-ink-inverse focus-darken"
          />
          <ZoomIn className="size-4 shrink-0 text-ink-inverse/70" aria-hidden="true" />
        </label>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <EditorAction
            icon={<RotateCw className="size-4" aria-hidden="true" />}
            label={t("rotate")}
            name="rotate"
            onClick={() =>
              setWorking((current) => {
                const rotation = rotateClockwise(current.rotation);
                if (!constrained) setZoom(wholePhotoZoom(rotation));
                return { ...current, rotation };
              })
            }
          />
          <EditorAction
            icon={<FlipHorizontal2 className="size-4" aria-hidden="true" />}
            label={t("flipHorizontal")}
            name="flip-horizontal"
            onClick={() => setWorking((current) => toggleDisplayFlip(current, "horizontal"))}
          />
          <EditorAction
            icon={<FlipVertical2 className="size-4" aria-hidden="true" />}
            label={t("flipVertical")}
            name="flip-vertical"
            onClick={() => setWorking((current) => toggleDisplayFlip(current, "vertical"))}
          />
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-ink-inverse/20" />
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
              setConstrained(false);
              setZoom(wholePhotoZoom(working.rotation));
              setOffset({ x: 0, y: 0 });
            }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-inverse/15 pt-4">
          <Button
            variant="quiet"
            onClick={onCancel}
            className="flex-1 text-ink-inverse hover:bg-ink-inverse/10 sm:flex-none"
          >
            {step && step.total > 1 ? t("skip") : t("cancel")}
          </Button>
          <Button
            onClick={() => onSave({ ...working, crop: area })}
            disabled={source === null || source === "failed"}
            className="flex-1 sm:flex-none"
            data-test-selector="image-editor-done"
          >
            {step && step.total > 1 && step.index < step.total ? t("saveAndNext") : t("saveAndClose")}
          </Button>
        </div>
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
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-pill bg-ink-inverse/10 px-3 text-label text-ink-inverse transition-colors hover:bg-ink-inverse/20 focus-visible:bg-ink-inverse/35"
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
        "inline-flex h-9 cursor-pointer items-center rounded-pill px-3 text-label transition-colors",
        isActive ? "bg-surface text-ink focus-darken" : "bg-ink-inverse/10 text-ink-inverse hover:bg-ink-inverse/20 focus-visible:bg-ink-inverse/35"
      )}
    >
      {label}
    </button>
  );
}
