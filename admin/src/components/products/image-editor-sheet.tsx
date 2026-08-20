"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
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
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageEditorSheetProps {
  /** The photograph to frame: a picked file's blob URL, or a stored original. */
  src: string;
  /** Whether `src` is on the API host — it decides how it can be read. */
  crossOrigin?: boolean;
  /** Where to open — the edit this photo already carries, or an untouched one. */
  edit: ImageEdit;
  /** "2 of 3" while working through a batch; absent for a single photo. */
  step?: { index: number; total: number } | null;
  onCancel: () => void;
  onSave: (edit: ImageEdit) => void;
}

/**
 * FRAMING A GARMENT, on a phone, with one thumb.
 *
 * The shop photographs stock on a counter between customers, and what comes
 * out of a phone camera is a room with a dress in it. Before this, the server
 * kept the whole picture and every screen letterboxed it onto a white plate —
 * so the catalogue was a grid of dresses at different sizes with different
 * amounts of shop around them. Now the person who took the photograph says
 * what the picture is of, in the seconds they have.
 *
 * Everything here is a NUMBER, never an image. What leaves this component is
 * a rectangle, a quarter turn and a mirror; the picture itself is cut by
 * sharp from the original file at full quality (spec.md "Editing a photograph
 * on upload"). A canvas re-encode on a phone would hand the server a picture
 * already decoded, scaled to fit a screen and re-compressed — which is
 * exactly the detail a shop zooming into a fabric wants back.
 *
 * The crop box is 2:3 by default, the catalogue's shape, because a consistent
 * grid is most of what makes a page of products look like a shop rather than
 * a folder. "Whole photo" is there for the piece that genuinely does not fit
 * it — and skipping the editor entirely still works exactly as it always did,
 * with the picture kept whole and the plate filling in behind it.
 */
export function ImageEditorSheet({ src, crossOrigin = false, edit, step, onCancel, onSave }: ImageEditorSheetProps) {
  const t = useTranslations("products.form.images.editor");

  // The cropper's own working state. `crop` is a pixel offset it owns; what
  // we keep is the AREA it reports, in fractions of the frame.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(IMAGE_ZOOM.min);
  const [working, setWorking] = useState<ImageEdit>(edit);
  const [area, setArea] = useState<ImageCrop | null>(edit.crop);
  // Off = the photograph's own shape, so the box frames all of it. On = the
  // catalogue's 2:3.
  const [constrained, setConstrained] = useState(true);
  // The picture as it is DRAWN — the size the cropper fitted it to, not the
  // file's own. Both halves of "keep the whole photograph" need it: the shape
  // the crop box has to take, and the zoom at which the box covers all of it.
  const [drawnSize, setDrawnSize] = useState<{ width: number; height: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // The picture the cropper is actually given: `src` scaled down to something
  // a phone will reliably decode (lib/image-edit.ts explains why at length).
  // Null while that is being prepared; "failed" when the photograph could not
  // be loaded at all, which is the one thing this screen must not swallow.
  const [source, setSource] = useState<{ url: string } | "failed" | null>(null);

  useEffect(() => {
    let cancelled = false;
    let owned: string | null = null;

    void loadEditorSource(src, { crossOrigin }).then((result) => {
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
  }, [src, crossOrigin]);

  // No effect resets any of this when the photograph changes, because the
  // photograph never changes: the gallery mounts one editor per photo
  // (`key={target.id}`), so moving to the next in a batch is a fresh
  // component with its own initial state. Carrying a zoom or a crop from the
  // last photograph to the next one is exactly the bug that would be.

  /**
   * The zoom at which the crop box covers the ENTIRE photograph.
   *
   * Not 1. The cropper fits the picture into the frame by its own shape and
   * then turns it, so a portrait photo turned a quarter is drawn wider than
   * the frame it is in — at zoom 1 the box would hold about three quarters of
   * it, and "whole photo" would quietly crop. Worse, the parts left out are
   * off the edge of the screen, so nobody can see what they are losing.
   *
   * The box's own size is the cropper's arithmetic (getCropSize in its
   * source), repeated here because it does not expose the result: the box is
   * the largest rectangle of the wanted shape that fits inside BOTH the
   * picture and the frame around it.
   *
   * Measured when it is needed — on entering this mode, and on each turn
   * inside it — rather than watched, because those are the only two moments
   * it can change and an event handler is a great deal less machinery than a
   * resize observer.
   */
  const wholePhotoZoom = useCallback(
    (rotation: ImageEdit["rotation"]): number => {
      const frame = canvasRef.current?.getBoundingClientRect();
      if (!frame || !drawnSize) return IMAGE_ZOOM.min;
      const picture = rotatedFrameSize(drawnSize, rotation);
      const aspect = picture.width / picture.height;
      const fittingWidth = Math.min(picture.width, frame.width);
      const fittingHeight = Math.min(picture.height, frame.height);
      const boxWidth = fittingWidth > fittingHeight * aspect ? fittingHeight * aspect : fittingWidth;
      // Never above 1: at that point the box already holds everything, and a
      // zoom over 1 would enlarge the picture for no reason.
      return Math.min(IMAGE_ZOOM.min, boxWidth / picture.width);
    },
    [drawnSize]
  );

  const handleCropComplete = useCallback((percentages: Area) => {
    // Percentages (0–100) straight from the cropper, stored as fractions and
    // handed BACK to it unchanged when the editor re-opens. Deliberately not
    // converted for the mirror: see "WHY THE CROP NEEDS NO CONVERSION" in
    // @organza/shared/lib/imageEdit — the two reflections cancel, and
    // "correcting" this is how every cropped photo ends up mirrored.
    setArea({
      x: percentages.x / 100,
      y: percentages.y / 100,
      width: percentages.width / 100,
      height: percentages.height / 100,
    });
  }, []);

  // The frame's shape once the turn is taken into account: a portrait photo
  // turned a quarter is a landscape frame, and a box that ignored that would
  // stop framing the whole picture the moment somebody straightened it.
  const drawnFrame = drawnSize ? rotatedFrameSize(drawnSize, working.rotation) : null;
  const wholeFrameAspect = drawnFrame ? drawnFrame.width / drawnFrame.height : PRODUCT_IMAGE_ASPECT_RATIO;

  return (
    // Fixed and above everything: this is the whole screen for as long as it
    // is open, like the phone's own photo editor. It is not a Sheet — a side
    // panel with a 24rem cap is the wrong shape for a portrait photograph,
    // and a photo editor that shows the form behind it invites a tap that
    // loses the crop.
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      data-test-selector="image-editor"
      // The app cancels every pinch (globals.css "An app, not a page in a
      // browser") — except here, where pinching to zoom into a garment IS the
      // feature. The guards walk up from the touch's target looking for
      // exactly this.
      data-allow-zoom="true"
    >
      {/* Top bar: leave, what this is, keep. Both actions are 44px and sit at
          the two ends, so either thumb reaches one without crossing the
          picture — and they mirror with the language like everything else. */}
      <div className="flex items-center justify-between gap-2 px-2 pt-[calc(var(--safe-top)+0.5rem)] text-white">
        {/* In a batch this LEAVES THIS PHOTO AS IT IS and moves to the next
            one — it does not throw the photograph away, and it does not
            abandon the rest of the batch. Saying "skip" rather than "cancel"
            is the difference between somebody pressing it once and somebody
            wondering whether they have just lost their work. */}
        <button
          type="button"
          onClick={onCancel}
          aria-label={step && step.total > 1 ? t("skip") : t("cancel")}
          data-test-selector="image-editor-cancel"
          className="inline-flex size-11 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
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
          className="inline-flex size-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          <Check className="size-6" aria-hidden="true" />
        </button>
      </div>

      {/* The picture. `flex-1` with `relative`, because the cropper positions
          itself absolutely and would otherwise fill the page. */}
      <div ref={canvasRef} className="relative min-h-0 flex-1" data-test-selector="image-editor-canvas">
        {source === null && (
          <div className="absolute inset-0 flex items-center justify-center" data-test-selector="image-editor-loading">
            <Spinner className="size-8 text-white" />
          </div>
        )}

        {/* A photograph the browser will not open. Said plainly, in the
            middle of the screen, instead of the black rectangle and the
            broken-image glyph that used to stand for it — the shop can then
            leave this one alone and carry on rather than wondering whether
            the app is broken. */}
        {source === "failed" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center"
            data-test-selector="image-editor-failed"
          >
            <p className="text-base font-medium text-white">{t("failed")}</p>
            <p className="text-sm text-white/70">{t("failedHint")}</p>
          </div>
        )}

        {source !== null && source !== "failed" && (
        <Cropper
          image={source.url}
          crop={offset}
          zoom={zoom}
          rotation={working.rotation}
          aspect={constrained ? PRODUCT_IMAGE_ASPECT_RATIO : wholeFrameAspect}
          // In "whole photo" the floor is whatever holds all of it, which is
          // below 1 for a turned picture; the cropper refuses a zoom under
          // its own minimum, so the two have to move together.
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
          // The mirror, applied to the PICTURE (to the right of the turn, so
          // it happens before it) — the same order sharp works in, which is
          // what keeps the preview and the stored photograph the same
          // picture. rotateY/rotateX rather than a negative scale so the two
          // read as what they are.
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

      {/* Controls. Below the picture on every screen: a phone is held at the
          bottom, and this is a screen for thumbs. */}
      <div
        className={cn(
          "flex flex-col gap-4 px-4 pb-[calc(var(--safe-bottom)+1rem)] pt-4 text-white",
          // Nothing to turn, mirror or frame until there is a picture on
          // screen — and a Save that stores a crop of a photograph nobody
          // could see is worse than a wait.
          source === null || source === "failed" ? "pointer-events-none opacity-40" : ""
        )}
      >
        {/* The zoom, for a mouse and for anybody who would rather not pinch.
            Pinching still works — this is the same value, said twice. */}
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
            className="h-11 w-full accent-white"
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
                // A turn changes the shape of the picture, so in "whole photo"
                // it changes the zoom that holds all of it too.
                if (!constrained) setZoom(wholePhotoZoom(rotation));
                return { ...current, rotation };
              })
            }
          />
          <EditorAction
            icon={<FlipHorizontal2 className="size-5" aria-hidden="true" />}
            label={t("flipHorizontal")}
            name="flip-horizontal"
            // "Mirror what I can see", which at a quarter turn is not the same
            // axis as the stored one — the mapping is in shared so both apps
            // and the server agree about which mirror was meant.
            onClick={() => setWorking((current) => toggleDisplayFlip(current, "horizontal"))}
          />
          <EditorAction
            icon={<FlipVertical2 className="size-5" aria-hidden="true" />}
            label={t("flipVertical")}
            name="flip-vertical"
            onClick={() => setWorking((current) => toggleDisplayFlip(current, "vertical"))}
          />
        </div>

        {/* The shape. 2:3 is the catalogue's and the default; the other choice
            is for the piece that genuinely does not fit it — a wide shot of a
            display, a fabric detail — which is kept whole and letterboxed on
            the photo plate exactly as an unedited photo is. */}
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
              // Back to the whole picture: the box takes the photograph's own
              // shape and the zoom returns to 1, so what is kept is
              // everything — and the crop it then reports resolves to no cut
              // at all, which is the same photograph an upload without the
              // editor produces.
              setConstrained(false);
              setZoom(wholePhotoZoom(working.rotation));
              setOffset({ x: 0, y: 0 });
            }}
          />
        </div>

        <Button
          type="button"
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
      // The label is always drawn, never left to a tooltip nobody on a phone
      // can summon: the people using this are not tech-savvy (CLAUDE.md
      // "Frontend UX"), and three unlabelled circles is a guessing game.
      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-medium text-white transition-colors hover:bg-white/20"
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
        "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors",
        isActive ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"
      )}
    >
      {label}
    </button>
  );
}
