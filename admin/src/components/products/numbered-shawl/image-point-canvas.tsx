"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import {
  POINT_MARKER_ASPECT_RATIO,
  POINT_MARKER_BORDER_PERCENT,
  POINT_MARKER_FONT_PERCENT,
  POINT_MARKER_RADIUS_PERCENT,
  POINT_MARKER_WIDTH_PERCENT,
  type PointColors,
} from "@organza/shared/constants/numberedShawl";
import { PRODUCT_PLACEHOLDER_PATH } from "@/constants/images";
import { hasImageFailed, markImageFailed, resolveImageUrl } from "@/lib/image-fallback";
import {
  NUMBERED_SHAWL_IMAGE_SIZES,
  POINT_CANVAS_MAX_HEIGHT,
  POINT_DRAG_THRESHOLD_PX,
  POINT_MARKER_MAX_BORDER_PX,
  POINT_MARKER_MAX_FONT_PX,
  POINT_MARKER_MAX_WIDTH_PX,
  POINT_MARKER_MIN_BORDER_PX,
  POINT_MARKER_MIN_FONT_PX,
  POINT_MARKER_MIN_WIDTH_PX,
  POINT_MARKER_TOUCH_PADDING_PX,
  POINT_PREVIEW_MAX_HEIGHT,
} from "@/constants/numberedShawl";
import { clampPercent } from "@/lib/validation/numbered-shawl";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ShawlPoint } from "@/types/numberedShawl";

interface ImagePointCanvasProps {
  imageUrl: string;
  alt: string;
  points: ShawlPoint[];
  // The colours the numbers are drawn in — one pair for the whole product,
  // already resolved (chosen / suggested / made legible) by
  // resolvePointColors. Passed in rather than resolved here so the editor can
  // show a colour being picked before it is saved.
  colors: PointColors;
  selectedId?: string | null;
  disabled?: boolean;
  // Display only (the product detail page): the same photo, the same pins,
  // the same coordinate space — with nothing to tap, drag or add. Sharing
  // the component is the point: the positions are percentages of THIS box,
  // so a second implementation would be a second chance to place them
  // differently.
  readOnly?: boolean;
  onAddPoint?: (x: number, y: number) => void;
  onMovePoint?: (id: string, x: number, y: number) => void;
  onSelectPoint?: (id: string | null) => void;
}

// Shared by the pin in both modes, so the read-only one can't drift from the
// one the points were placed with. Everything about its SIZE is inline and
// computed from the rendered image (markerStyle below); this is only the
// shape.
const PIN_CLASS =
  "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border-solid font-bold leading-none tabular-nums";

// A placeholder aspect ratio shown only until the real photo has loaded and
// reports its natural size (below) — most product photos are portrait.
const PLACEHOLDER_ASPECT_RATIO = 4 / 5;

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// The click/drag math below needs the *rendered* image's own box, with no
// letterboxing from object-fit — so once the photo loads, this sizes the
// container to the image's own natural aspect ratio via `fill` +
// `object-contain` over an exactly-matching box, instead of guessing at a
// fixed width/height up front (spec.md "Critical technical note").
export function ImagePointCanvas({
  imageUrl,
  alt,
  points,
  colors,
  selectedId = null,
  disabled,
  readOnly,
  onAddPoint,
  onMovePoint,
  onSelectPoint,
}: ImagePointCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  // How wide the photo is actually being drawn, in pixels. Every marker is a
  // proportion of it (see markerStyle), so the numbers scale with the photo
  // instead of crowding each other on a small one. Measured rather than
  // expressed in `cqw`, because the oldest phone in the shop is an iPhone 7
  // on iOS 15 and container queries are Safari 16 (see lib/compat).
  const [boxWidth, setBoxWidth] = useState(0);
  // Tracks a possible "tap to add" gesture on the empty canvas.
  const addGestureRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  // Tracks a possible drag/tap gesture on one pin.
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);

  const resolvedSrc = resolveImageUrl(imageUrl);
  // Seeded from the session's record of broken URLs, so re-opening the editor
  // on a photo already known to be gone goes straight to the placeholder.
  const [imageFailed, setImageFailed] = useState(() => hasImageFailed(resolvedSrc));

  // The placeholder can't report a natural size, so it stands in as "ready"
  // itself — otherwise the pins would never be drawn on top of it.
  const isReady = ratio !== null || imageFailed;

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    // Rotating the phone, the photo finally reporting its ratio, the window
    // being dragged wider — all resize the box without a re-render of their
    // own. The first delivery carries the box's current size, so there is no
    // separate measurement to take here.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setBoxWidth(width);
    });
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  function percentFromEvent(clientX: number, clientY: number) {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: clampPercent(((clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((clientY - rect.top) / rect.height) * 100),
    };
  }

  function handleBoxPointerDown(e: React.PointerEvent) {
    if (disabled || readOnly || !isReady) return;
    addGestureRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
  }

  function handleBoxPointerMove(e: React.PointerEvent) {
    const gesture = addGestureRef.current;
    if (!gesture) return;
    if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) > POINT_DRAG_THRESHOLD_PX) {
      gesture.moved = true;
    }
  }

  function handleBoxPointerUp(e: React.PointerEvent) {
    const gesture = addGestureRef.current;
    addGestureRef.current = null;
    if (disabled || readOnly || !isReady || !gesture || gesture.moved) return;
    const point = percentFromEvent(e.clientX, e.clientY);
    if (point) onAddPoint?.(point.x, point.y);
  }

  function handlePinPointerDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (disabled || readOnly) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id, moved: false };
  }

  function handlePinPointerMove(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (dragRef.current?.id !== id) return;
    e.stopPropagation();
    const point = percentFromEvent(e.clientX, e.clientY);
    if (!point) return;
    dragRef.current.moved = true;
    onMovePoint?.(id, point.x, point.y);
  }

  function handlePinPointerUp(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (dragRef.current?.id !== id) return;
    e.stopPropagation();
    const wasDrag = dragRef.current.moved;
    dragRef.current = null;
    if (!wasDrag) onSelectPoint?.(selectedId === id ? null : id);
  }

  // One marker, sized as a share of the photo as it is actually drawn — the
  // whole point of measuring boxWidth. A rounded rectangle rather than a
  // circle, because "10" and "12" do not sit comfortably inside a circle at a
  // size anybody would want to tap.
  //
  // Legibility on a busy photograph is three things at once: the chosen
  // background, an outline in the text's own colour (which the shared
  // resolver guarantees contrasts with it), and a soft shadow that lifts the
  // whole badge off whatever is behind it.
  const markerWidth = clamp(
    POINT_MARKER_MIN_WIDTH_PX,
    (boxWidth * POINT_MARKER_WIDTH_PERCENT) / 100,
    POINT_MARKER_MAX_WIDTH_PX
  );
  const markerHeight = markerWidth / POINT_MARKER_ASPECT_RATIO;
  const borderWidth = clamp(
    POINT_MARKER_MIN_BORDER_PX,
    (boxWidth * POINT_MARKER_BORDER_PERCENT) / 100,
    POINT_MARKER_MAX_BORDER_PX
  );
  const markerStyle: CSSProperties = {
    width: `${markerWidth}px`,
    height: `${markerHeight}px`,
    borderRadius: `${(markerHeight * POINT_MARKER_RADIUS_PERCENT) / 100}px`,
    fontSize: `${clamp(
      POINT_MARKER_MIN_FONT_PX,
      (boxWidth * POINT_MARKER_FONT_PERCENT) / 100,
      POINT_MARKER_MAX_FONT_PX
    )}px`,
    borderWidth: `${borderWidth}px`,
    color: colors.text,
    backgroundColor: colors.background,
    borderColor: colors.text,
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.45)",
  };

  const maxHeight = readOnly ? POINT_PREVIEW_MAX_HEIGHT : POINT_CANVAS_MAX_HEIGHT;
  const boxRatio = ratio ?? PLACEHOLDER_ASPECT_RATIO;

  return (
    <div
      className={cn(
        // Centred in both modes, because the box is now narrower than its
        // column whenever the height cap is what bounds the photo.
        "flex justify-center",
        // Reading the shawl (the detail page): the photo and its numbers,
        // with nothing around them — the same as the ordinary gallery, which
        // lost its card, its border and its plate for the same reason.
        // Placing the points (the editor): the grey work surface, framed,
        // because there the photo is a canvas being worked on.
        !readOnly && "overflow-hidden rounded-xl border border-border bg-muted"
      )}
    >
      <div
        ref={boxRef}
        onPointerDown={readOnly ? undefined : handleBoxPointerDown}
        onPointerMove={readOnly ? undefined : handleBoxPointerMove}
        onPointerUp={readOnly ? undefined : handleBoxPointerUp}
        style={{
          aspectRatio: boxRatio,
          // Capped by height AND width at once: a very tall photo can no
          // longer push the rest of the screen below the fold, and a wide one
          // still fills the column. The ratio is the photo's own, so the
          // points — percentages of THIS box — stay exactly where they were
          // put whichever of the two caps bites.
          width: `min(100%, calc(${boxRatio} * ${maxHeight}))`,
        }}
        className={cn("relative select-none", !readOnly && "touch-none")}
      >
        {imageFailed ? (
          // The photo is gone. The pins still are not: they are stored as
          // percentages of this box, so the box keeps its shape and they keep
          // their places over the placeholder, waiting for the photo to be
          // re-uploaded. Left to next/image this was a spinner that never
          // stopped — `onLoad` never fires for an image that failed, so the
          // canvas sat "loading" forever with the numbers unreachable.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={PRODUCT_PLACEHOLDER_PATH} alt="" className="size-full object-contain" draggable={false} />
        ) : (
          <Image
            src={resolvedSrc}
            alt={alt}
            fill
            sizes={NUMBERED_SHAWL_IMAGE_SIZES}
            className="object-contain"
            draggable={false}
            priority
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
            }}
            onError={() => {
              markImageFailed(resolvedSrc);
              setImageFailed(true);
            }}
          />
        )}

        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}

        {isReady &&
          points.map((point) =>
            readOnly ? (
              <span key={point.id} style={{ ...markerStyle, left: `${point.x}%`, top: `${point.y}%` }} className={PIN_CLASS}>
                {point.number}
              </span>
            ) : (
              <button
                key={point.id}
                type="button"
                aria-label={String(point.number)}
                aria-pressed={selectedId === point.id}
                onPointerDown={(e) => handlePinPointerDown(e, point.id)}
                onPointerMove={(e) => handlePinPointerMove(e, point.id)}
                onPointerUp={(e) => handlePinPointerUp(e, point.id)}
                style={{
                  ...markerStyle,
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  // The selection ring is an OUTLINE, not a border or a
                  // Tailwind ring: both of those are the badge's own edge,
                  // which now belongs to the shop's colours.
                  outline: selectedId === point.id ? `${borderWidth + 1}px solid var(--primary)` : undefined,
                  outlineOffset: `${borderWidth}px`,
                }}
                className={cn(PIN_CLASS, "touch-none", selectedId === point.id && "z-10")}
              >
                {/* The badge stays the size the photo says; the FINGER gets
                    its 44px from this invisible pad around it. Growing the
                    badge instead is what made the numbers crowd each other on
                    a small rendering. */}
                <span aria-hidden="true" className="absolute" style={{ inset: `-${POINT_MARKER_TOUCH_PADDING_PX}px` }} />
                {point.number}
              </button>
            )
          )}
      </div>
    </div>
  );
}
