import type { JSX } from "react";
import { useTranslation } from "@ui/lib/i18n";
import { Button } from "@ui/components/button";
import { Icon } from "@ui/components/icon";
import { cn } from "@ui/lib/cn";
import { parts, type TestIdProps } from "@ui/lib/testid";

export interface SaveBarProps extends TestIdProps {
  readonly visible: boolean;
  readonly saving?: boolean | undefined;
  readonly invalid?: boolean | undefined;
  readonly onSave: () => void;
  readonly onDiscard: () => void;
  readonly message?: string | undefined;
  readonly className?: string | undefined;
}

export function SaveBar({
  visible,
  saving = false,
  invalid = false,
  onSave,
  onDiscard,
  message,
  className,
  "data-testid": testId,
}: SaveBarProps): JSX.Element {
  const { t } = useTranslation();
  const part = parts("save-bar", testId);

  return (
    <>
      {visible && <div {...part("spacer")} aria-hidden="true" className="h-24" />}
      <div
        {...part()}
        role="region"
        aria-label={t("ui.common.unsavedChanges")}
        data-state={visible ? "open" : "closed"}
        inert={!visible}
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center",
          "px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-6",
          className,
        )}
      >
        <div
          {...part("glass")}
          className={cn(
            "pointer-events-auto relative isolate flex w-full max-w-(--field-max) items-center gap-2 overflow-hidden rounded-pill p-1.5 ps-4",
            "border border-surface/80 bg-surface/90 shadow-glass",
            "supports-[backdrop-filter]:bg-surface/10",
            "supports-[backdrop-filter]:backdrop-blur-sm supports-[backdrop-filter]:backdrop-saturate-180 supports-[backdrop-filter]:backdrop-brightness-105",
            "transition-[translate,opacity,scale] duration-500",
            visible
              ? "translate-y-0 scale-100 opacity-100 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
              : "translate-y-[calc(100%+1.5rem)] scale-90 opacity-0 ease-[cubic-bezier(0.32,0.72,0,1)]",
          )}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-l from-primary-100/40 via-transparent to-primary-50/30"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-1/2 rounded-b-[50%] bg-gradient-to-b from-surface/70 via-surface/15 to-transparent"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-surface to-transparent"
          />

          <p {...part("message")} className="flex min-w-0 flex-1 items-center gap-2.5 text-label">
            <span aria-hidden="true" className="relative flex size-2 shrink-0">
              <span className="absolute inset-0 rounded-pill bg-warning-500 opacity-60 motion-safe:animate-ping" />
              <span className="relative size-2 rounded-pill bg-warning-500" />
            </span>
            <span className="truncate font-medium text-ink">
              {message ?? t("ui.common.unsavedChanges")}
            </span>
          </p>
          <Button
            {...part("discard")}
            variant="quiet"
            className="rounded-pill border border-surface/70 bg-surface/40 text-ink hover:bg-surface/70"
            onClick={onDiscard}
          >
            {t("ui.common.discard")}
          </Button>
          <Button
            {...part("save")}
            icon={<Icon name="check" />}
            className="rounded-pill px-4 shadow-pill ring-1 ring-surface/30 ring-inset"
            isLoading={saving}
            {...(invalid && { "aria-disabled": true })}
            onClick={onSave}
          >
            {t("ui.common.save")}
          </Button>
        </div>
      </div>
    </>
  );
}
