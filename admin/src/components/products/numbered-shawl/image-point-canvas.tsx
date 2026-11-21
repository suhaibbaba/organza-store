"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { Spinner } from "@store/ui";
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
import { testSelectorFor } from "@organza/shared/lib/testSelector";
import { clampPercent } from "@/lib/validation/numbered-shawl";
import { cn } from "@/lib/utils";
import type { PlacedShawlPoint } from "@/types/numberedShawl";

interface ImagePointCanvasProps {
  imageUrl: string;
  alt: string;
  points: PlacedShawlPoint[];
  // Already resolved by resolvePointColors; passed in so the editor can show an unsaved pick.
  colors: PointColors;
  selectedId?: string | null;
  disabled?: boolean;
  // Display only (detail page): same box and coordinate space, so positions can't diverge.
  readOnly?: boolean;
  onAddPoint?: (x: number, y: number) => void;
  onMovePoint?: (id: string, x: number, y: number) => void;
  onSelectPoint?: (id: string | null) => void;
}

// Shape only; size is computed from the rendered image (markerStyle).
const PIN_CLASS =
  "absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border-solid font-bold leading-none tabular-nums";

// Until the photo reports its natural size; most product photos are portrait.
const PLACEHOLDER_ASPECT_RATIO = 4 / 5;

function clamp(min: number, value: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Box sized to the photo's natural ratio so click/drag math has no letterboxing (spec.md "Critical technical note").
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
  // Measured, not `cqw`: the shop's oldest phone is iOS 15 without container queries.
  const [boxWidth, setBoxWidth] = useState(0);
  // Tracks a possible "tap to add" gesture on the empty canvas.
  const addGestureRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  // Tracks a possible drag/tap gesture on one pin.
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);

  const resolvedSrc = resolveImageUrl(imageUrl);
  // Seeded from the session's known-broken URLs so a dead photo goes straight to the placeholder.
  const [imageFailed, setImageFailed] = useState(() => hasImageFailed(resolvedSrc));

  // The placeholder counts as ready, or the pins would never draw over it.
  const isReady = ratio !== null || imageFailed;

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
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

  // Sized as a share of the drawn photo; legible via the chosen background, a text-colour outline and a soft shadow.
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
        "flex justify-center",
        // Read-only: bare photo like the gallery; editor: a framed work surface.
        !readOnly && "overflow-hidden rounded-panel border border-line bg-inset"
      )}
    >
      <div
        ref={boxRef}
        onPointerDown={readOnly ? undefined : handleBoxPointerDown}
        onPointerMove={readOnly ? undefined : handleBoxPointerMove}
        onPointerUp={readOnly ? undefined : handleBoxPointerUp}
        style={{
          aspectRatio: boxRatio,
          // Capped by height and width; the ratio is the photo's own so the points stay put.
          width: `min(100%, calc(${boxRatio} * ${maxHeight}))`,
        }}
        className={cn("relative select-none", !readOnly && "touch-none")}
        data-test-selector={readOnly ? "shawl-point-canvas-readonly" : "shawl-point-canvas"}
      >
        {imageFailed ? (
          // Pins are percentages of this box, so they keep their places over the placeholder; next/image's onLoad never fires on failure.
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
              <span
                key={point.id}
                style={{ ...markerStyle, left: `${point.x}%`, top: `${point.y}%` }}
                className={PIN_CLASS}
                data-test-selector={testSelectorFor("shawl-point", point.number)}
              >
                {point.number}
              </span>
            ) : (
              <button
                key={point.id}
                type="button"
                aria-label={String(point.number)}
                aria-pressed={selectedId === point.id}
                // Named by its NUMBER, never its position (the thing being moved).
                data-test-selector={testSelectorFor("shawl-point", point.number)}
                onPointerDown={(e) => handlePinPointerDown(e, point.id)}
                onPointerMove={(e) => handlePinPointerMove(e, point.id)}
                onPointerUp={(e) => handlePinPointerUp(e, point.id)}
                style={{
                  ...markerStyle,
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  // An outline, because the badge's own edge belongs to the shop's colours.
                  outline: selectedId === point.id ? `${borderWidth + 1}px solid var(--color-primary-600)` : undefined,
                  outlineOffset: `${borderWidth}px`,
                }}
                className={cn(PIN_CLASS, "touch-none focus-darken", selectedId === point.id && "z-10")}
              >
                {/* The finger gets its 44px from this invisible pad; growing the badge made numbers crowd. */}
                <span aria-hidden="true" className="absolute" style={{ inset: `-${POINT_MARKER_TOUCH_PADDING_PX}px` }} />
                {point.number}
              </button>
            )
          )}
      </div>
    </div>
  );
}
