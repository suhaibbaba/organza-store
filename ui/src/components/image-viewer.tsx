import * as Dialog from "@radix-ui/react-dialog";
import type { JSX } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { documentDirection } from "@ui/lib/direction";
import { useReturnFocus } from "@ui/lib/return-focus";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface ImageViewerImage {
  readonly id: string;
  readonly src: string;
  readonly thumbnailSrc: string;
  readonly alt: string;
}

export interface ImageViewerProps extends TestIdProps {
  readonly images: readonly ImageViewerImage[];
  readonly index: number;
  readonly onIndexChange: (index: number) => void;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

const ROUND_TOOL =
  "inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-ink/55 text-ink-inverse " +
  "transition-colors hover:bg-ink/75 focus-visible:bg-ink/90";

// The photo alone, large, with every photo of the set small under it; no panel behind it, only a dim of the page.
export function ImageViewer({
  images,
  index,
  onIndexChange,
  open,
  onOpenChange,
  "data-testid": testId,
}: ImageViewerProps): JSX.Element {
  const { t } = useTranslation();
  useReturnFocus(open);
  const part = parts("image-viewer", testId);
  const count = images.length;
  const current = images[Math.min(Math.max(index, 0), Math.max(count - 1, 0))];
  const go = (step: number): void => {
    if (count > 1) onIndexChange((index + step + count) % count);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          {...part("overlay")}
          className={cn(
            "fixed inset-0 z-50 bg-ink/80 backdrop-blur-sm",
            "data-[state=open]:animate-[fade-in_200ms_ease-out]",
            "data-[state=closed]:animate-[fade-out_150ms_ease-in]",
          )}
        />
        <Dialog.Content
          {...part()}
          dir={documentDirection()}
          aria-describedby={undefined}
          onKeyDown={(event) => {
            // Arrows follow the reading direction: in Arabic the next photo is to the left.
            const rtl = documentDirection() === "rtl";
            if (event.key === "ArrowRight") go(rtl ? -1 : 1);
            else if (event.key === "ArrowLeft") go(rtl ? 1 : -1);
          }}
          className={cn(
            "fixed inset-0 z-50 flex flex-col items-center gap-3 p-4 outline-none sm:p-6",
            "data-[state=open]:animate-[fade-in_160ms_ease-out]",
          )}
          onClick={(event) => {
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
        >
          <Dialog.Title className="sr-only">{t("ui.common.imageViewer.title")}</Dialog.Title>

          <div className="flex w-full items-center justify-between gap-2">
            {count > 1 ? (
              <span {...part("counter")} className="rounded-pill bg-ink/55 px-3 py-1 text-meta text-ink-inverse tabular-nums">
                {t("ui.common.imageViewer.counter", { current: index + 1, total: count })}
              </span>
            ) : (
              <span />
            )}
            <Dialog.Close {...part("close")} aria-label={t("ui.common.close")} title={t("ui.common.close")} className={ROUND_TOOL}>
              <Icon name="x" />
            </Dialog.Close>
          </div>

          <div
            className="relative flex min-h-0 w-full flex-1 items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) onOpenChange(false);
            }}
          >
            {current && (
              <img
                {...part("image")}
                key={current.id}
                src={current.src}
                alt={current.alt}
                className="max-h-full max-w-full rounded-panel object-contain shadow-float animate-[fade-in_160ms_ease-out]"
              />
            )}
            {count > 1 && (
              <>
                <button
                  type="button"
                  {...part("previous")}
                  aria-label={t("ui.common.imageViewer.previous")}
                  title={t("ui.common.imageViewer.previous")}
                  onClick={() => go(-1)}
                  className={cn(ROUND_TOOL, "absolute start-0 top-1/2 -translate-y-1/2")}
                >
                  <Icon name="chevron-start" />
                </button>
                <button
                  type="button"
                  {...part("next")}
                  aria-label={t("ui.common.imageViewer.next")}
                  title={t("ui.common.imageViewer.next")}
                  onClick={() => go(1)}
                  className={cn(ROUND_TOOL, "absolute end-0 top-1/2 -translate-y-1/2")}
                >
                  <Icon name="chevron-end" />
                </button>
              </>
            )}
          </div>

          {count > 1 && (
            <div {...part("thumbnails")} className="flex max-w-full gap-2 overflow-x-auto p-1">
              {images.map((image, position) => (
                <button
                  key={image.id}
                  type="button"
                  {...part(`thumbnail-${position + 1}`)}
                  aria-label={t("ui.common.imageViewer.show", { number: position + 1 })}
                  aria-current={position === index ? "true" : undefined}
                  onClick={() => onIndexChange(position)}
                  className={cn(
                    "size-14 shrink-0 cursor-pointer overflow-hidden rounded-control bg-surface ring-2 ring-offset-2 ring-offset-ink/0 transition-opacity sm:size-16",
                    position === index ? "ring-ink-inverse" : "opacity-60 ring-transparent hover:opacity-100 focus-visible:opacity-100",
                  )}
                >
                  <img src={image.thumbnailSrc} alt="" className="size-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
