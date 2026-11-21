import type { JSX } from "react";
import { Img } from "@ui/components/img";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface AvatarProps extends TestIdProps {
  readonly name: string;
  readonly tintKey?: string | undefined;
  readonly src?: string | null | undefined;
  readonly size?: number | undefined;
  readonly className?: string | undefined;
}

const TINTS = [
  "bg-tint-1-bg text-tint-1-ink",
  "bg-tint-2-bg text-tint-2-ink",
  "bg-tint-3-bg text-tint-3-ink",
  "bg-tint-4-bg text-tint-4-ink",
  "bg-tint-5-bg text-tint-5-ink",
  "bg-tint-6-bg text-tint-6-ink",
] as const;

function tintFor(key: string): string {
  let hash = 0;

  for (const character of key) {
    hash = (hash * 31 + character.codePointAt(0)!) % 1_000_003;
  }

  return TINTS[hash % TINTS.length] ?? TINTS[0];
}

export function Avatar({
  name,
  tintKey,
  src,
  size = DEFAULT_SIZE,
  className,
  "data-testid": testId,
}: AvatarProps): JSX.Element {
  const part = parts("avatar", testId);
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0] ?? "")
    .join("");

  const shape = "pill-text inline-flex items-center shrink-0 select-none rounded-pill";

  const tint = tintKey === undefined ? "bg-tint-2-bg text-tint-2-ink" : tintFor(tintKey);

  if (src === null || src === undefined || src === "") {
    return (
      <span
        {...part()}
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={cn(shape, "justify-center text-label font-medium", tint, className)}
      >
        {initials}
      </span>
    );
  }

  return (
    <Img
      {...part()}
      src={src}
      alt=""
      width={size}
      height={size}
      fit="cover"
      fallback={
        <span
          {...part("initials")}
          aria-hidden="true"
          className={cn(
            "absolute inset-0 flex items-center justify-center text-label font-medium",
            tint,
          )}
        >
          {initials}
        </span>
      }
      className={cn(shape, "border border-line bg-sunken", className)}
    />
  );
}

const DEFAULT_SIZE = 36;
