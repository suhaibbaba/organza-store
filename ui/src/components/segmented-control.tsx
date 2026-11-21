import { useEffect, useLayoutEffect, useRef, useState, type JSX } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Icon } from "@ui/components/icon";
import { Ltr } from "@ui/components/ltr";
import { cn } from "@ui/lib/cn";
import { documentDirection } from "@ui/lib/direction";
import { rovingKeyDown, rovingStop } from "@ui/lib/roving-focus";
import { testid, type TestIdProps } from "@ui/lib/testid";

export interface SegmentOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly count?: number | undefined;
}

export type SegmentedControlSize = "md" | "sm";

export interface SegmentedControlProps<TValue extends string> extends TestIdProps {
  readonly options: readonly SegmentOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly label: string;
  readonly size?: SegmentedControlSize | undefined;
  readonly className?: string | undefined;
}

const SIZES: Record<SegmentedControlSize, { track: string; option: string; thumb: string }> = {
  md: {
    track: "p-0.75",
    option: "h-[calc(var(--control-h)-6px)] px-3.5",
    thumb: "top-0.75 h-[calc(var(--control-h)-6px)]",
  },
  sm: {
    track: "p-0.5",
    option: "size-[calc(var(--control-h-sm)-4px)] px-0",
    thumb: "top-0.5 h-[calc(var(--control-h-sm)-4px)]",
  },
};

interface Overflow {
  readonly left: boolean;
  readonly right: boolean;
}

interface Thumb {
  readonly left: number;
  readonly width: number;
}

function measureOverflow(track: HTMLElement): Overflow {
  const max = track.scrollWidth - track.clientWidth;
  const fromLeft =
    getComputedStyle(track).direction === "rtl" ? track.scrollLeft + max : track.scrollLeft;

  return { left: fromLeft > 1, right: fromLeft < max - 1 };
}

export function SegmentedControl<TValue extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
  "data-testid": testId,
}: SegmentedControlProps<TValue>): JSX.Element {
  const { t } = useTranslation();
  const values = options.map((option) => option.value);
  const stop = rovingStop(values, value);
  const track = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<Thumb | null>(null);
  const [overflow, setOverflow] = useState<Overflow>({ left: false, right: false });
  const [animate, setAnimate] = useState(false);

  const pick = (next: TValue): void => {
    setAnimate(true);
    onChange(next);
  };

  useLayoutEffect(() => {
    const update = (): void => {
      const element = track.current;

      if (!element) {
        return;
      }

      const picked = element.querySelector<HTMLElement>('[aria-checked="true"]');
      setThumb(picked ? { left: picked.offsetLeft, width: picked.offsetWidth } : null);
      setOverflow(measureOverflow(element));
    };

    update();

    if (!track.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(update);
    observer.observe(track.current);
    return () => observer.disconnect();
  }, [value, options.length]);

  useEffect(() => {
    track.current
      ?.querySelector<HTMLElement>('[aria-checked="true"]')
      ?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [value]);

  const scroll = (side: "left" | "right"): void => {
    const element = track.current;
    element?.scrollBy({
      left: (side === "left" ? -1 : 1) * element.clientWidth * 0.7,
      behavior: "smooth",
    });
  };

  const arrow = (side: "left" | "right"): JSX.Element => {
    const rtl = documentDirection() === "rtl";
    const pointsStart = (side === "left") !== rtl;

    return (
      <button
        type="button"
        tabIndex={-1}
        data-part="segment-scroll"
        {...testid(testId, `scroll-${side}`)}
        aria-label={t("ui.common.showMore")}
        onClick={() => scroll(side)}
        className={cn(
          "absolute top-1/2 z-20 inline-grid size-7 -translate-y-1/2 place-items-center rounded-pill",
          "cursor-pointer bg-surface text-ink shadow-chip transition-colors hover:text-primary-700",
          side === "left" ? "left-1" : "right-1",
        )}
      >
        <Icon name={pointsStart ? "chevron-start" : "chevron-end"} className="size-4" />
      </button>
    );
  };

  return (
    <div
      data-part="segmented-control"
      {...testid(testId)}
      className={cn("relative isolate inline-flex max-w-full min-w-0", className)}
    >
      {overflow.left && arrow("left")}
      <div
        ref={track}
        role="radiogroup"
        aria-label={label}
        data-part="segment-track"
        onScroll={(event) => setOverflow(measureOverflow(event.currentTarget))}
        onKeyDown={(event) => rovingKeyDown(event, values, value, pick)}
        className={cn(
          "relative isolate inline-flex max-w-full overflow-x-auto rounded-pill bg-inset",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          SIZES[size].track,
          overflow.left && overflow.right
            ? "fade-x"
            : overflow.left
              ? "fade-l"
              : overflow.right && "fade-r",
        )}
      >
        {thumb && (
          <span
            aria-hidden="true"
            data-part="segment-thumb"
            style={{ width: thumb.width, transform: `translateX(${thumb.left}px)` }}
            className={cn(
              "pointer-events-none absolute left-0 -z-10 rounded-pill bg-surface shadow-chip",
              "motion-reduce:transition-none",
              SIZES[size].thumb,
              animate && "transition-[transform,width] duration-420 ease-glide",
            )}
          />
        )}
        {options.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              data-part="segment"
              {...testid(testId, option.value)}
              role="radio"
              aria-checked={isSelected}
              tabIndex={option.value === stop ? 0 : -1}
              data-roving
              onClick={() => pick(option.value)}
              className={cn(
                "pill-text inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5",
                "whitespace-nowrap rounded-pill text-label font-medium transition-colors",
                SIZES[size].option,
                isSelected ? "text-ink" : "text-ink-muted hover:text-ink",
                "focus-visible:bg-neutral-300 focus-visible:text-primary-900",
              )}
            >
              {option.label}
              {option.count !== undefined && (
                <Ltr
                  data-part="segment-count"
                  {...testid(testId, `${option.value}-count`)}
                  className={cn(
                    "pill-text inline-flex h-4 min-w-4 items-center justify-center",
                    "rounded-pill px-[7px] text-micro font-medium tabular-nums",
                    isSelected
                      ? "bg-primary-100 text-primary-700"
                      : "bg-danger-100 text-danger-600",
                  )}
                >
                  {option.count}
                </Ltr>
              )}
            </button>
          );
        })}
      </div>
      {overflow.right && arrow("right")}
    </div>
  );
}
