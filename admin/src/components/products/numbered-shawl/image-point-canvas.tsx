"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { API_BASE_URL } from "@/lib/env";
import { POINT_DRAG_THRESHOLD_PX, NUMBERED_SHAWL_IMAGE_SIZES } from "@/constants/numberedShawl";
import { clampPercent } from "@/lib/validation/numbered-shawl";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ShawlPoint } from "@/types/numberedShawl";

interface ImagePointCanvasProps {
  imageUrl: string;
  alt: string;
  points: ShawlPoint[];
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
// one the points were placed with.
const PIN_CLASS =
  "absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-xs font-bold shadow-md";

// A placeholder aspect ratio shown only until the real photo has loaded and
// reports its natural size (below) — most product photos are portrait.
const PLACEHOLDER_ASPECT_RATIO = 4 / 5;

// The click/drag math below needs the *rendered* image's own box, with no
// letterboxing from object-fit — so once the photo loads, this sizes the
// container to the image's own natural aspect ratio via `fill` +
// `object-contain` over an exactly-matching box, instead of guessing at a
// fixed width/height up front (spec.md "Critical technical note").
export function ImagePointCanvas({
  imageUrl,
  alt,
  points,
  selectedId = null,
  disabled,
  readOnly,
  onAddPoint,
  onMovePoint,
  onSelectPoint,
}: ImagePointCanvasProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState<number | null>(null);
  // Tracks a possible "tap to add" gesture on the empty canvas.
  const addGestureRef = useRef<{ startX: number; startY: number; moved: boolean } | null>(null);
  // Tracks a possible drag/tap gesture on one pin.
  const dragRef = useRef<{ id: string; moved: boolean } | null>(null);

  const resolvedSrc = imageUrl.startsWith("http") ? imageUrl : `${API_BASE_URL}${imageUrl}`;
  const isReady = ratio !== null;

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

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted">
      <div
        ref={boxRef}
        onPointerDown={readOnly ? undefined : handleBoxPointerDown}
        onPointerMove={readOnly ? undefined : handleBoxPointerMove}
        onPointerUp={readOnly ? undefined : handleBoxPointerUp}
        style={{ aspectRatio: ratio ?? PLACEHOLDER_ASPECT_RATIO }}
        className={cn("relative select-none", !readOnly && "touch-none")}
      >
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
        />

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
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                className={cn(PIN_CLASS, "border-white bg-black/70 text-white")}
              >
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
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                className={cn(
                  PIN_CLASS,
                  "touch-none",
                  selectedId === point.id
                    ? "border-primary-foreground bg-primary text-primary-foreground ring-2 ring-primary"
                    : "border-white bg-black/70 text-white"
                )}
              >
                {point.number}
              </button>
            )
          )}
      </div>
    </div>
  );
}
