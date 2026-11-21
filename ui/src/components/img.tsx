import { useState, type CSSProperties, type JSX, type ReactNode } from "react";
import { Icon } from "@ui/components/icon";
import { Skeleton } from "@ui/components/skeleton";
import { cn } from "@ui/lib/cn";
import { testid, type TestIdProps } from "@ui/lib/testid";

interface FluidSizing {
  readonly aspectRatio: string;
  readonly width?: never;
  readonly height?: never;
}

interface FixedSizing {
  readonly width: number;
  readonly height: number;
  readonly aspectRatio?: never;
}

interface ImgBase extends TestIdProps {
  readonly src: string | null | undefined;
  readonly alt: string;
  readonly className?: string | undefined;
  readonly fit?: "cover" | "contain" | undefined;
  readonly priority?: boolean | undefined;
  readonly fallback?: ReactNode | undefined;
  readonly "data-part"?: string | undefined;
}

export type ImgProps = ImgBase & (FluidSizing | FixedSizing);

type ImgState = "loading" | "loaded" | "failed";

export function Img({
  src,
  alt,
  className,
  fit = "cover",
  priority = false,
  fallback,
  "data-part": part = "img",
  "data-testid": testId,
  ...sizing
}: ImgProps): JSX.Element {
  const [settled, setSettled] = useState<{ readonly src: string; readonly state: ImgState }>({
    src: "",
    state: "loading",
  });
  const state: ImgState = settled.src === src ? settled.state : "loading";

  const settle = (next: ImgState): void => {
    if (src && !(settled.src === src && settled.state === next)) {
      setSettled({ src, state: next });
    }
  };

  const box: CSSProperties =
    sizing.aspectRatio === undefined
      ? { width: sizing.width, height: sizing.height }
      : { aspectRatio: sizing.aspectRatio };

  const missing = src === null || src === undefined || src === "";
  const showFallback = missing || state === "failed";

  return (
    <span
      style={box}
      data-part={part}
      {...testid(testId)}
      data-img-box
      className={cn("relative block max-w-full shrink-0 overflow-hidden", className)}
    >
      {!missing && state !== "failed" && (
        <img
          data-part="img-file"
          {...testid(testId, "file")}
          src={src}
          alt={alt}
          ref={(image) => {
            if (image?.complete && image.naturalWidth > 0) {
              settle("loaded");
            }
          }}
          onLoad={() => settle("loaded")}
          onError={() => settle("failed")}
          {...(priority
            ? { loading: "eager" as const, fetchPriority: "high" as const }
            : { loading: "lazy" as const })}
          decoding="async"
          className={cn(
            "size-full transition-opacity duration-[120ms]",
            fit === "cover" ? "object-cover" : "object-contain",
            state === "loaded" ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {!missing && state === "loading" && (
        <Skeleton className="absolute inset-0 size-full rounded-none" />
      )}

      {showFallback &&
        (fallback ?? (
          <span
            data-part="img-fallback"
            {...testid(testId, "fallback")}
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-inset text-ink-subtle"
          >
            <Icon name="image" />
          </span>
        ))}
    </span>
  );
}
